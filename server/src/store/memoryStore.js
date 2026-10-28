class TelemetryStore {
  constructor() {
    this.telemetrySubscribers = new Map();
    this.terminalEvents = new Map(); // executionId -> { eventType, data }
    this.workflows = new Map(); // id -> workflow
    this.executions = new Map(); // executionId -> execution record
  }

  // --- In-Memory Workflow Storage (Cache & Fallback) ---
  saveWorkflow(workflow) {
    if (!workflow || !workflow.id) return null;
    const existing = this.workflows.get(workflow.id);
    const now = new Date().toISOString();
    const record = {
      ...existing,
      ...workflow,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.workflows.set(workflow.id, record);
    return record;
  }

  getWorkflow(id) {
    if (!id) return null;
    if (this.workflows.has(id)) return this.workflows.get(id);
    for (const wf of this.workflows.values()) {
      if (wf.legacy_id === id || wf.id === id) return wf;
    }
    return null;
  }

  listWorkflows() {
    return Array.from(this.workflows.values());
  }

  deleteWorkflow(id) {
    return this.workflows.delete(id);
  }

  // --- In-Memory Execution Storage (Cache & Fallback) ---
  createExecution(record) {
    if (!record || !record.id) return null;
    const now = new Date().toISOString();
    const entry = {
      id: record.id,
      workflowId: record.workflowId,
      workflowName: record.workflowName,
      status: record.status || 'PENDING',
      triggerPayload: record.triggerPayload || {},
      startedAt: now,
      finishedAt: null,
      durationMs: null,
      steps: record.steps || [],
      logs: record.logs || [],
    };
    this.executions.set(record.id, entry);
    return entry;
  }

  getExecution(id) {
    if (!id) return null;
    return this.executions.get(id) || null;
  }

  updateExecution(id, updates = {}) {
    const existing = this.executions.get(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    this.executions.set(id, merged);
    return merged;
  }

  listExecutions(workflowId = null) {
    const list = Array.from(this.executions.values());
    if (workflowId) {
      return list.filter((e) => e.workflowId === workflowId);
    }
    return list;
  }

  clearExecutions() {
    this.executions.clear();
  }

  // --- SSE Telemetry Subscribers & Streaming ---
  addSubscriber(executionId, reply) {
    if (!this.telemetrySubscribers.has(executionId)) {
      this.telemetrySubscribers.set(executionId, new Set());
    }
    this.telemetrySubscribers.get(executionId).add(reply);

    // If execution has already concluded with a terminal event, replay it immediately
    const terminal = this.terminalEvents.get(executionId);
    if (terminal) {
      try {
        const payload = `event: ${terminal.eventType}\ndata: ${JSON.stringify(terminal.data)}\n\n`;
        reply.raw.write(payload);
      } catch {
        this.removeSubscriber(executionId, reply);
      }
    }
  }

  removeSubscriber(executionId, reply) {
    const subscribers = this.telemetrySubscribers.get(executionId);
    if (!subscribers) return;
    subscribers.delete(reply);
    if (subscribers.size === 0) this.telemetrySubscribers.delete(executionId);
  }

  broadcastTelemetry(executionId, eventType, data) {
    // Keep in-memory execution record updated with telemetry events
    const exec = this.executions.get(executionId);
    if (exec) {
      if (eventType === 'execution_started') {
        exec.status = 'RUNNING';
      } else if (eventType === 'execution_completed') {
        exec.status = 'SUCCESS';
        exec.finishedAt = new Date().toISOString();
        if (data?.durationMs) exec.durationMs = data.durationMs;
      } else if (eventType === 'execution_failed') {
        exec.status = 'FAILED';
        exec.finishedAt = new Date().toISOString();
        exec.error = data?.error;
        if (data?.durationMs) exec.durationMs = data.durationMs;
      } else if (eventType === 'node_status') {
        const existingStep = exec.steps.find((s) => s.nodeId === data.nodeId);
        if (existingStep) {
          existingStep.status = data.status;
        } else {
          exec.steps.push({
            nodeId: data.nodeId,
            status: data.status,
            timestamp: data.timestamp || Date.now(),
          });
        }
      } else if (eventType === 'node_log') {
        exec.logs.push(data);
      }
    }

    if (eventType === 'execution_completed' || eventType === 'execution_failed') {
      this.terminalEvents.set(executionId, { eventType, data });
      if (this.terminalEvents.size > 500) {
        const oldestKey = this.terminalEvents.keys().next().value;
        this.terminalEvents.delete(oldestKey);
      }
    }

    const subscribers = this.telemetrySubscribers.get(executionId);
    if (!subscribers) return;

    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const reply of subscribers) {
      try {
        reply.raw.write(payload);
      } catch {
        subscribers.delete(reply);
      }
    }
  }
}

export const memoryStore = new TelemetryStore();
