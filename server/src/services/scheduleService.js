import cron from 'node-cron';
import { nanoid } from 'nanoid';
import { memoryStore } from '../store/memoryStore.js';
import { executeWorkflow } from '../engine/executor.js';
import {
  createExecution,
  getWorkflow,
  listAllWorkflows,
} from '../db/workflowRepository.js';

/**
 * In-memory storage for active schedules and their running cron tasks.
 * Active cron task instances are kept strictly in `activeTasks` and are NEVER serialized.
 */
const schedules = new Map(); // scheduleId -> schedule metadata object
const activeTasks = new Map(); // scheduleId -> cron.ScheduledTask

/**
 * Validates a 5-field cron expression using node-cron.
 */
export function validateCronExpression(expression) {
  if (!expression || typeof expression !== 'string') {
    return { valid: false, error: 'Cron expression must be a non-empty string' };
  }

  const trimmed = expression.trim();
  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5) {
    return {
      valid: false,
      error: `Cron expression must have exactly 5 fields (minute hour day-of-month month day-of-week). Found ${fields.length}.`,
    };
  }

  const isValid = cron.validate(trimmed);
  if (!isValid) {
    return { valid: false, error: 'Invalid cron expression format' };
  }

  return { valid: true, error: null };
}

/**
 * Generates a human-friendly description of common schedule patterns.
 */
export function describeSchedule(cronExpression, timezone = 'Asia/Kolkata') {
  const validation = validateCronExpression(cronExpression);
  if (!validation.valid) {
    return `Invalid schedule (${validation.error})`;
  }

  const parts = cronExpression.trim().split(/\s+/);
  const [min, hour, dom, mon, dow] = parts;

  let desc = '';
  if (min === '*' && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    desc = 'Every minute';
  } else if (min.startsWith('*/') && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    desc = `Every ${min.slice(2)} minute(s)`;
  } else if (min === '0' && hour.startsWith('*/') && dom === '*' && mon === '*' && dow === '*') {
    desc = `Every ${hour.slice(2)} hour(s)`;
  } else if (!min.includes('*') && !hour.includes('*') && dom === '*' && mon === '*' && dow === '*') {
    const padMin = min.padStart(2, '0');
    const padHour = hour.padStart(2, '0');
    desc = `Daily at ${padHour}:${padMin}`;
  } else if (!min.includes('*') && !hour.includes('*') && dom === '*' && mon === '*' && dow !== '*') {
    const padMin = min.padStart(2, '0');
    const padHour = hour.padStart(2, '0');
    const daysMap = {
      '0': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat', '7': 'Sun',
      'MON': 'Mon', 'TUE': 'Tue', 'WED': 'Wed', 'THU': 'Thu', 'FRI': 'Fri', 'SAT': 'Sat', 'SUN': 'Sun'
    };
    const dayNames = dow.split(',').map((d) => daysMap[d.toUpperCase()] || d).join(', ');
    desc = `Weekly on [${dayNames}] at ${padHour}:${padMin}`;
  } else {
    desc = `Custom cron: ${cronExpression}`;
  }

  return `${desc} (${timezone})`;
}

/**
 * Computes downstream reachable nodes and edges starting from `triggerNodeId`.
 */
export function getReachableSubgraph(nodes = [], edges = [], startNodeId = null) {
  if (!startNodeId) {
    return { nodes, edges };
  }

  const startNode = nodes.find((n) => n.id === startNodeId);
  if (!startNode) {
    return { nodes, edges };
  }

  const adj = new Map();
  for (const n of nodes) {
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (adj.has(e.source)) {
      adj.get(e.source).push(e.target);
    }
  }

  const visited = new Set([startNodeId]);
  const queue = [startNodeId];

  while (queue.length > 0) {
    const curr = queue.shift();
    const neighbors = adj.get(curr) || [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  const reachableNodes = nodes.filter((n) => visited.has(n.id));
  const reachableEdges = edges.filter((e) => visited.has(e.source) && visited.has(e.target));

  return { nodes: reachableNodes, edges: reachableEdges };
}

/**
 * Creates or updates an in-memory schedule and registers the cron task.
 */
export function registerSchedule(params) {
  const {
    id,
    workflowId,
    triggerNodeId,
    cronExpression,
    timezone = 'Asia/Kolkata',
    enabled = true,
    summary,
    scheduleType = 'custom',
    workflow,
  } = params;

  if (!workflowId) {
    throw new Error('workflowId is required to register a schedule.');
  }

  const validation = validateCronExpression(cronExpression);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Deterministic schedule ID associated with workflow and trigger node
  const scheduleId = id || (triggerNodeId ? `sched_${workflowId}_${triggerNodeId}` : `sched_${workflowId}_${nanoid(6)}`);

  // If a workflow object was provided, ensure it is persisted in memoryStore
  if (workflow && workflow.nodes) {
    memoryStore.saveWorkflow({
      ...workflow,
      id: workflowId,
    });
  }

  // Stop and clean up any existing cron task for this scheduleId (prevents duplicate tasks)
  if (activeTasks.has(scheduleId)) {
    try {
      activeTasks.get(scheduleId).stop();
    } catch (e) {
      console.warn(`Error stopping previous task for ${scheduleId}:`, e.message);
    }
    activeTasks.delete(scheduleId);
  }

  const friendlySummary = summary || describeSchedule(cronExpression, timezone);
  const now = new Date().toISOString();

  const existingRecord = schedules.get(scheduleId);
  const scheduleRecord = {
    id: scheduleId,
    workflowId,
    triggerNodeId: triggerNodeId || existingRecord?.triggerNodeId || null,
    cronExpression: cronExpression.trim(),
    timezone: timezone || 'Asia/Kolkata',
    enabled: Boolean(enabled),
    summary: friendlySummary,
    scheduleType,
    createdAt: existingRecord?.createdAt || now,
    updatedAt: now,
    lastRunAt: existingRecord?.lastRunAt || null,
    lastExecutionId: existingRecord?.lastExecutionId || null,
    runCount: existingRecord?.runCount || 0,
    status: enabled ? 'ACTIVE' : 'PAUSED',
    lastError: null,
  };

  if (enabled) {
    let isRunning = false; // Overlap prevention guard

    try {
      const task = cron.schedule(
        cronExpression.trim(),
        async () => {
          if (isRunning) {
            console.warn(`[ScheduleService] Skipping run for ${scheduleId}: previous run still in progress.`);
            return;
          }

          isRunning = true;
          try {
            console.info(`[ScheduleService] Firing cron task for schedule ${scheduleId} (${cronExpression} ${timezone})`);
            await executeScheduledWorkflow(scheduleId, false);
          } catch (err) {
            console.error(`[ScheduleService] Execution failed for schedule ${scheduleId}:`, err);
            const entry = schedules.get(scheduleId);
            if (entry) {
              entry.lastError = err.message;
              entry.status = 'ERROR';
            }
          } finally {
            isRunning = false;
          }
        },
        {
          timezone: timezone || 'Asia/Kolkata',
          scheduled: true,
        }
      );

      activeTasks.set(scheduleId, task);
      console.info(`[ScheduleService] Registered active cron task "${scheduleId}": ${cronExpression.trim()} (${timezone})`);
    } catch (err) {
      scheduleRecord.status = 'ERROR';
      scheduleRecord.lastError = `Failed to initialize cron task: ${err.message}`;
      console.error(`[ScheduleService] Failed to schedule cron task:`, err);
    }
  }

  schedules.set(scheduleId, scheduleRecord);
  return serializeSchedule(scheduleRecord);
}

/**
 * Dispatches the execution of a scheduled workflow.
 * Starts execution at the Schedule Trigger node and traverses downstream.
 */
export async function executeScheduledWorkflow(scheduleId, manualTrigger = false) {
  const schedule = schedules.get(scheduleId);
  if (!schedule) {
    throw new Error(`Schedule with id "${scheduleId}" not found in memory.`);
  }

  let fullWorkflow = memoryStore.getWorkflow(schedule.workflowId);
  if (!fullWorkflow) {
    try {
      fullWorkflow = await getWorkflow(schedule.workflowId);
      if (fullWorkflow) {
        memoryStore.saveWorkflow(fullWorkflow);
      }
    } catch (e) {
      // DB lookup failed, proceed to validation error
    }
  }

  if (!fullWorkflow) {
    throw new Error(`Workflow "${schedule.workflowId}" not found. Ensure the workflow is saved.`);
  }

  // 1. Isolate downstream reachable subgraph starting from the schedule trigger
  const { nodes, edges } = getReachableSubgraph(
    fullWorkflow.nodes || [],
    fullWorkflow.edges || [],
    schedule.triggerNodeId
  );

  const executableWorkflow = {
    ...fullWorkflow,
    nodes,
    edges,
  };

  const executionId = `exec_sched_${nanoid(8)}`;
  const scheduledTime = new Date().toISOString();

  const triggerPayload = {
    triggerType: 'schedule',
    triggerNodeId: schedule.triggerNodeId,
    cronExpression: schedule.cronExpression,
    timezone: schedule.timezone,
    scheduledAt: scheduledTime,
    summary: schedule.summary,
    manualTrigger,
    source: 'schedule-trigger',
    subject: `[Schedule Trigger] ${fullWorkflow.name || 'Workflow'} Run`,
    body: `Workflow "${fullWorkflow.name || fullWorkflow.id}" triggered on schedule "${schedule.cronExpression}" (${schedule.timezone}) at ${scheduledTime}. Dispatched by Kahn Engine Schedule Trigger.`,
  };

  // 2. Create execution record in DB (and in memoryStore)
  const executionRecord = {
    id: executionId,
    workflowId: fullWorkflow.id,
    workflowName: fullWorkflow.name,
    triggerPayload,
  };

  try {
    await createExecution(executionRecord);
  } catch (err) {
    console.warn(`[ScheduleService] DB createExecution fallback to memory:`, err.message);
  }
  memoryStore.createExecution(executionRecord);

  // 3. Update schedule runtime stats
  schedule.lastRunAt = scheduledTime;
  schedule.lastExecutionId = executionId;
  schedule.runCount = (schedule.runCount || 0) + 1;
  schedule.status = schedule.enabled ? 'ACTIVE' : 'PAUSED';
  schedule.lastError = null;
  schedules.set(scheduleId, schedule);

  // 4. Execute downstream nodes deterministically
  setImmediate(async () => {
    try {
      await executeWorkflow(executableWorkflow, executionId, triggerPayload);
    } catch (err) {
      console.error(`[ScheduleService] Background execution failed for ${executionId}:`, err);
    }
  });

  return {
    executionId,
    scheduleId,
    workflowId: fullWorkflow.id,
    scheduledAt: scheduledTime,
    nodeCount: nodes.length,
    status: 'PENDING',
  };
}

/**
 * Updates an existing schedule in memory and updates the cron task.
 */
export function updateSchedule(scheduleId, updates = {}) {
  const existing = schedules.get(scheduleId);
  if (!existing) {
    throw new Error(`Schedule "${scheduleId}" not found.`);
  }

  const cronExpr = updates.cronExpression || existing.cronExpression;
  const tz = updates.timezone || existing.timezone;
  const isEnabled = updates.enabled !== undefined ? Boolean(updates.enabled) : existing.enabled;

  return registerSchedule({
    id: scheduleId,
    workflowId: updates.workflowId || existing.workflowId,
    triggerNodeId: updates.triggerNodeId || existing.triggerNodeId,
    cronExpression: cronExpr,
    timezone: tz,
    enabled: isEnabled,
    summary: updates.summary,
    scheduleType: updates.scheduleType || existing.scheduleType,
    workflow: updates.workflow,
  });
}

/**
 * Toggles a schedule between enabled and disabled.
 */
export function toggleSchedule(scheduleId, enabled) {
  return updateSchedule(scheduleId, { enabled: Boolean(enabled) });
}

/**
 * Stops the active task and removes the schedule from memory.
 */
export function removeSchedule(scheduleId) {
  const existing = schedules.get(scheduleId);
  if (!existing) {
    return false;
  }

  if (activeTasks.has(scheduleId)) {
    try {
      activeTasks.get(scheduleId).stop();
    } catch (e) {
      console.warn(`Error stopping task ${scheduleId}:`, e.message);
    }
    activeTasks.delete(scheduleId);
  }

  schedules.delete(scheduleId);
  return true;
}

/**
 * Removes all schedules associated with a workflow.
 */
export function removeWorkflowSchedules(workflowId) {
  if (!workflowId) return 0;
  let count = 0;
  for (const [schedId, sched] of schedules.entries()) {
    if (sched.workflowId === workflowId) {
      removeSchedule(schedId);
      count++;
    }
  }
  return count;
}

/**
 * Syncs schedules from a workflow object (e.g. after save or on startup).
 * Finds all schedule/cron trigger nodes in the workflow and registers active cron tasks.
 */
export function syncWorkflowSchedules(workflow) {
  if (!workflow || !workflow.id) return [];
  const nodes = workflow.nodes || [];
  const scheduleNodes = nodes.filter((node) => {
    const type = String(node?.data?.configType || node?.type || '').toLowerCase();
    return ['crontrigger', 'cron', 'scheduletrigger'].includes(type);
  });

  const isWorkflowActive = workflow.status === 'active' || workflow.status === 'ACTIVE' || !workflow.status;
  const currentScheduleIds = new Set();
  const registeredList = [];

  for (const node of scheduleNodes) {
    const config = node?.data?.configuration || node?.data || {};
    const cronExpr = config.cronExpression || config.schedule;
    if (!cronExpr) continue;

    const validation = validateCronExpression(cronExpr);
    if (!validation.valid) {
      console.warn(`[ScheduleService] Invalid cron expression for node ${node.id} in workflow ${workflow.id}:`, validation.error);
      continue;
    }

    const scheduleId = `sched_${workflow.id}_${node.id}`;
    currentScheduleIds.add(scheduleId);

    const isNodeEnabled = config.enabled !== false;
    const shouldRun = isWorkflowActive && isNodeEnabled;
    const timezone = config.timezone || 'Asia/Kolkata';

    const registered = registerSchedule({
      id: scheduleId,
      workflowId: workflow.id,
      triggerNodeId: node.id,
      cronExpression: cronExpr,
      timezone,
      enabled: shouldRun,
      summary: config.summary || describeSchedule(cronExpr, timezone),
      scheduleType: config.scheduleType || 'custom',
      workflow,
    });
    registeredList.push(registered);
  }

  // Clean up any stale schedules for nodes removed from this workflow
  for (const [schedId, sched] of schedules.entries()) {
    if (sched.workflowId === workflow.id && !currentScheduleIds.has(schedId)) {
      removeSchedule(schedId);
    }
  }

  return registeredList;
}

/**
 * Initializes schedules for all active workflows in the database/store.
 * Called on server startup.
 */
export async function initializeScheduler() {
  try {
    let workflows = [];
    try {
      workflows = await listAllWorkflows();
    } catch (err) {
      console.warn(`[ScheduleService] DB listAllWorkflows failed, checking memoryStore:`, err.message);
      workflows = memoryStore.listWorkflows();
    }

    let activeCount = 0;
    for (const wf of workflows) {
      const synced = syncWorkflowSchedules(wf);
      activeCount += synced.filter((s) => s.enabled).length;
    }

    console.info(`[ScheduleService] Scheduler initialized: ${activeCount} active schedule task(s) running across ${workflows.length} workflow(s).`);
  } catch (err) {
    console.error(`[ScheduleService] Failed to initialize scheduler:`, err);
  }
}

/**
 * Stops all active scheduler cron tasks. Called on server shutdown.
 */
export function stopScheduler() {
  for (const [id, task] of activeTasks.entries()) {
    try {
      task.stop();
    } catch (e) {
      console.warn(`Error stopping task ${id}:`, e.message);
    }
  }
  activeTasks.clear();
  schedules.clear();
  console.info('[ScheduleService] All active cron schedules stopped.');
}

/**
 * Returns a single schedule by ID (or by workflowId if found).
 */
export function getSchedule(scheduleId) {
  const entry = schedules.get(scheduleId);
  if (entry) return serializeSchedule(entry);

  // Fallback: check by workflowId
  for (const item of schedules.values()) {
    if (item.workflowId === scheduleId || item.triggerNodeId === scheduleId) {
      return serializeSchedule(item);
    }
  }

  return null;
}

/**
 * Lists all schedules in memory, optionally filtered by workflowId.
 */
export function listSchedules(workflowId = null) {
  const list = Array.from(schedules.values());
  const filtered = workflowId ? list.filter((s) => s.workflowId === workflowId) : list;
  return filtered.map(serializeSchedule);
}

/**
 * Strips any internal non-serializable properties before returning to client.
 */
function serializeSchedule(record) {
  return {
    id: record.id,
    workflowId: record.workflowId,
    triggerNodeId: record.triggerNodeId,
    cronExpression: record.cronExpression,
    timezone: record.timezone,
    enabled: record.enabled,
    summary: record.summary,
    scheduleType: record.scheduleType,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastRunAt: record.lastRunAt,
    lastExecutionId: record.lastExecutionId,
    runCount: record.runCount,
    status: record.status,
    lastError: record.lastError,
    hasActiveTask: activeTasks.has(record.id),
  };
}
