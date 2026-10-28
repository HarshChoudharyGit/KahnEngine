import cron from 'node-cron';
import { nanoid } from 'nanoid';
import {
  createExecution,
  listAllWorkflows,
} from '../db/workflowRepository.js';
import { executeWorkflow } from '../engine/executor.js';

const activeTasks = new Map();

function scheduledNodes(workflow) {
  return (workflow.nodes || []).flatMap((node) => {
    const type = String(node?.data?.configType || node?.type || '').toLowerCase();
    const configuration = node?.data?.configuration || node?.data || {};
    if (!['crontrigger', 'cron'].includes(type) ||
        typeof configuration.schedule !== 'string' ||
        configuration.enabled === false) {
      return [];
    }

    return [{
      node,
      cronExpression: configuration.schedule.trim(),
      timezone: configuration.timezone || 'UTC',
    }];
  });
}

function stopWorkflowSchedules(workflowId) {
  for (const [scheduleId, entry] of activeTasks) {
    if (entry.workflowId !== workflowId) continue;
    entry.task.stop();
    activeTasks.delete(scheduleId);
  }
}

export function refreshWorkflowSchedules(workflow) {
  const schedules = scheduledNodes(workflow).map((schedule) => {
    if (!cron.validate(schedule.cronExpression)) {
      throw new Error(`Invalid cron expression for workflow node "${schedule.node.id}": ${schedule.cronExpression}`);
    }
    return schedule;
  });

  stopWorkflowSchedules(workflow.id);

  for (const { node, cronExpression, timezone } of schedules) {
    const scheduleId = `${workflow.id}:${node.id}`;

    let isRunning = false;
    const task = cron.schedule(cronExpression, async (context) => {
      if (isRunning) {
        console.warn(`[WorkflowScheduler] Skipping overlapping run for ${scheduleId}.`);
        return;
      }

      isRunning = true;
      const scheduledAt = context?.date?.toISOString() || new Date().toISOString();
      const firedAt = new Date().toISOString();
      const executionId = `exec_sched_${nanoid(8)}`;
      const triggerPayload = {
        triggerType: 'schedule',
        source: 'schedule',
        triggerNodeId: node.id,
        cronExpression,
        timezone,
        scheduledAt,
        firedAt,
      };

      console.info(`[WorkflowScheduler] Fired ${scheduleId} at ${firedAt} for ${scheduledAt}.`);
      try {
        await createExecution({
          id: executionId,
          workflowId: workflow.id,
          workflowName: workflow.name,
          triggerPayload,
        });
        setImmediate(() => {
          void executeWorkflow(workflow, executionId, triggerPayload)
            .catch((err) => {
              console.error(`[WorkflowScheduler] Execution ${executionId} failed unexpectedly:`, err);
            })
            .finally(() => {
              isRunning = false;
            });
        });
      } catch (err) {
        isRunning = false;
        console.error(`[WorkflowScheduler] Could not dispatch ${scheduleId}:`, err);
      }
    }, { timezone });

    activeTasks.set(scheduleId, { workflowId: workflow.id, task });
  }
}

export function removeWorkflowSchedules(workflowId) {
  stopWorkflowSchedules(workflowId);
}

export async function initializeWorkflowScheduler() {
  const workflows = await listAllWorkflows();
  for (const workflow of workflows) {
    try {
      refreshWorkflowSchedules(workflow);
    } catch (err) {
      console.error(`[WorkflowScheduler] Could not register workflow "${workflow.id}":`, err);
    }
  }
  console.info(`[WorkflowScheduler] Restored schedules for ${workflows.length} workflows.`);
}

export function stopWorkflowScheduler() {
  for (const entry of activeTasks.values()) {
    entry.task.stop();
  }
  activeTasks.clear();
}
