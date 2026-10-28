/**
 * Kahn Engine API Client & Real-Time Telemetry Stream Service
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE_URL}/health`);
  return res.json();
}

export async function listWorkflows() {
  const res = await fetch(`${API_BASE_URL}/api/v1/workflows`);
  if (!res.ok) throw new Error('Failed to fetch workflows');
  const data = await res.json();
  return data.workflows || [];
}

export async function getWorkflow(id) {
  const res = await fetch(`${API_BASE_URL}/api/v1/workflows/${id}`);
  if (!res.ok) throw new Error(`Workflow ${id} not found`);
  const data = await res.json();
  return data.workflow;
}

export async function saveWorkflow(workflow) {
  const res = await fetch(`${API_BASE_URL}/api/v1/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save workflow');
  }
  return data;
}

export async function deleteWorkflow(id) {
  const res = await fetch(`${API_BASE_URL}/api/v1/workflows/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Failed to delete workflow ${id}`);
  }
  return data;
}

export async function deleteAllWorkflows() {
  const res = await fetch(`${API_BASE_URL}/api/v1/workflows`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete all workflows');
  }
  return data;
}

export async function executeWorkflow(workflowId, payload = {}) {
  const res = await fetch(`${API_BASE_URL}/api/v1/workflows/${workflowId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error || 'Execution dispatch failed');
    error.nodeErrors = data.nodeErrors;
    error.cycleNodes = data.cycleNodes;
    throw error;
  }
  return data;
}

export async function listExecutions(workflowId = null) {
  const url = workflowId
    ? `${API_BASE_URL}/api/v1/executions?workflowId=${encodeURIComponent(workflowId)}`
    : `${API_BASE_URL}/api/v1/executions`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch executions');
  const data = await res.json();
  return data.executions || [];
}

export async function getExecution(executionId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/executions/${executionId}`);
  if (!res.ok) throw new Error(`Execution ${executionId} not found`);
  const data = await res.json();
  return data.execution;
}

export async function clearExecutionsApi() {
  const res = await fetch(`${API_BASE_URL}/api/v1/executions`, {
    method: 'DELETE',
  });
  return res.json();
}

/**
 * Connects to the Server-Sent Events (SSE) telemetry stream for a specific run.
 * Returns an unsubscribe cleanup function.
 */
export function connectTelemetryStream(executionId, handlers = {}) {
  const streamUrl = `${API_BASE_URL}/api/v1/telemetry/stream/${executionId}`;
  const eventSource = new EventSource(streamUrl);

  const safeParse = (event) => {
    try {
      return JSON.parse(event.data);
    } catch {
      return event.data;
    }
  };

  eventSource.addEventListener('connected', (event) => {
    handlers.onConnected?.(safeParse(event));
  });

  eventSource.addEventListener('execution_started', (event) => {
    handlers.onStarted?.(safeParse(event));
  });

  eventSource.addEventListener('node_status', (event) => {
    handlers.onNodeStatus?.(safeParse(event));
  });

  eventSource.addEventListener('node_log', (event) => {
    handlers.onNodeLog?.(safeParse(event));
  });

  eventSource.addEventListener('loop_progress', (event) => {
    handlers.onLoopProgress?.(safeParse(event));
  });

  eventSource.addEventListener('execution_completed', (event) => {
    handlers.onCompleted?.(safeParse(event));
    eventSource.close();
  });

  eventSource.addEventListener('execution_failed', (event) => {
    handlers.onFailed?.(safeParse(event));
    eventSource.close();
  });

  eventSource.onerror = (err) => {
    handlers.onError?.(err);
    // Don't close immediately if reconnecting, unless completed/failed
  };

  return () => {
    eventSource.close();
  };
}

export async function validateCronApi(cronExpression, timezone = 'Asia/Kolkata') {
  const res = await fetch(`${API_BASE_URL}/api/v1/schedules/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cronExpression, timezone }),
  });
  return res.json();
}

export async function registerScheduleApi(scheduleData) {
  const res = await fetch(`${API_BASE_URL}/api/v1/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scheduleData),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to register schedule');
  }
  return data;
}

export async function runScheduleNowApi(scheduleId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/schedules/${scheduleId}/run`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to run schedule');
  }
  return data;
}

export async function listSchedulesApi(workflowId) {
  const url = workflowId
    ? `${API_BASE_URL}/api/v1/schedules?workflowId=${encodeURIComponent(workflowId)}`
    : `${API_BASE_URL}/api/v1/schedules`;
  const res = await fetch(url);
  return res.json();
}

/**
 * Sends a natural language prompt to the AI workflow generator.
 * Returns a complete workflow with nodes and edges.
 */
export async function generateWorkflowFromPrompt(prompt) {
  const res = await fetch(`${API_BASE_URL}/api/v1/ai/generate-workflow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to generate workflow');
  }
  return data.workflow;
}
