/**
 * Simple in-memory storage for workflows and execution records.
 * Provides instant reactivity without requiring an external database setup.
 */

class MemoryStore {
  constructor() {
    this.workflows = new Map();
    this.executions = new Map();
    this.telemetrySubscribers = new Map(); // executionId -> Set of response streams
  }

  // Workflows
  saveWorkflow(workflow) {
    this.workflows.set(workflow.id, {
      ...workflow,
      updatedAt: new Date().toISOString(),
      createdAt: workflow.createdAt || new Date().toISOString(),
    });
    return this.workflows.get(workflow.id);
  }

  getWorkflow(id) {
    return this.workflows.get(id) || null;
  }

  listWorkflows() {
    return Array.from(this.workflows.values());
  }

  deleteWorkflow(id) {
    return this.workflows.delete(id);
  }

  // Executions
  createExecution(record) {
    const entry = {
      ...record,
      status: 'PENDING',
      nodeStatuses: {},
      logs: [],
      steps: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
      durationMs: null,
    };
    this.executions.set(record.id, entry);
    return entry;
  }

  getExecution(id) {
    return this.executions.get(id) || null;
  }

  listExecutions(workflowId = null) {
    const list = Array.from(this.executions.values());
    if (workflowId) {
      return list.filter((e) => e.workflowId === workflowId).reverse();
    }
    return list.reverse();
  }

  clearExecutions() {
    this.executions.clear();
  }

  updateExecution(id, partial) {
    const existing = this.executions.get(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...partial,
      nodeStatuses: {
        ...existing.nodeStatuses,
        ...(partial.nodeStatuses || {}),
      },
      steps: partial.steps || existing.steps,
    };
    this.executions.set(id, updated);
    return updated;
  }

  appendStep(executionId, step) {
    const execution = this.executions.get(executionId);
    if (execution) {
      if (!execution.steps) execution.steps = [];
      execution.steps.push(step);
    }
  }

  appendLog(executionId, logEntry) {
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.logs.push(logEntry);
    }
  }

  // Telemetry SSE Subscriptions
  addSubscriber(executionId, reply) {
    if (!this.telemetrySubscribers.has(executionId)) {
      this.telemetrySubscribers.set(executionId, new Set());
    }
    this.telemetrySubscribers.get(executionId).add(reply);
  }

  removeSubscriber(executionId, reply) {
    const set = this.telemetrySubscribers.get(executionId);
    if (set) {
      set.delete(reply);
      if (set.size === 0) {
        this.telemetrySubscribers.delete(executionId);
      }
    }
  }

  broadcastTelemetry(executionId, eventType, data) {
    const set = this.telemetrySubscribers.get(executionId);
    if (!set) return;

    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const reply of set) {
      try {
        reply.raw.write(payload);
      } catch {
        set.delete(reply);
      }
    }
  }
}

export const memoryStore = new MemoryStore();
