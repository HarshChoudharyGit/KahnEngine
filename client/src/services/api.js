/**
 * Kahn Engine API Client & Real-Time Telemetry Stream Service
 */
// API Calls//

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Checks server health status and API gateway connectivity
export async function fetchHealth() {
  const res = await fetch(`${API_BASE_URL}/health`);
  return res.json();
}

// Retrieves all saved workflows from the backend
export async function listWorkflows() {
  const res = await fetch(`${API_BASE_URL}/api/v1/workflows`);
  if (!res.ok) throw new Error('Failed to fetch workflows');
  const data = await res.json();
  return data.workflows || [];
}

// Retrieves a single workflow by its unique ID
export async function getWorkflow(id) {
  const res = await fetch(`${API_BASE_URL}/api/v1/workflows/${id}`);
  if (!res.ok) throw new Error(`Workflow ${id} not found`);
  const data = await res.json();
  return data.workflow;
}

// Saves or updates a workflow graph with Kahn's algorithm cycle validation
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

// Deletes a workflow and its associated connections
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

// Dispatches a manual or automated workflow execution (<10ms acknowledgment)
export async function executeWorkflow(workflowId, payload = {}) {
  const res = await fetch(`${API_BASE_URL}/api/v1/workflows/${workflowId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Execution dispatch failed');
  }
  return data;
}

// Lists past execution records, optionally filtered by workflow ID
export async function listExecutions(workflowId = null) {
  const url = workflowId
    ? `${API_BASE_URL}/api/v1/executions?workflowId=${encodeURIComponent(workflowId)}`
    : `${API_BASE_URL}/api/v1/executions`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch executions');
  const data = await res.json();
  return data.executions || [];
}

// Retrieves detailed execution status, per-node steps, and worker logs
export async function getExecution(executionId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/executions/${executionId}`);
  if (!res.ok) throw new Error(`Execution ${executionId} not found`);
  const data = await res.json();
  return data.execution;
}

// Clears all execution run history from memory
export async function clearExecutionsApi() {
  const res = await fetch(`${API_BASE_URL}/api/v1/executions`, {
    method: 'DELETE',
  });
  return res.json();
}

// Connects to the Server-Sent Events (SSE) stream for real-time node state and log telemetry
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

// Schedules API

// Validates a cron expression string against a given timezone
export async function validateCronApi(cronExpression, timezone = 'Asia/Kolkata') {
  const res = await fetch(`${API_BASE_URL}/api/v1/schedules/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cronExpression, timezone }),
  });
  return res.json();
}

// Fetches active schedules, optionally filtered by workflow ID
export async function listSchedulesApi(workflowId = null) {
  const url = workflowId
    ? `${API_BASE_URL}/api/v1/schedules?workflowId=${encodeURIComponent(workflowId)}`
    : `${API_BASE_URL}/api/v1/schedules`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch schedules');
  const data = await res.json();
  return data.schedules || [];
}

// Retrieves schedule metadata and current status by schedule ID
export async function getScheduleApi(id) {
  const res = await fetch(`${API_BASE_URL}/api/v1/schedules/${id}`);
  if (!res.ok) throw new Error(`Schedule ${id} not found`);
  const data = await res.json();
  return data.schedule;
}

// Registers a new schedule task in the in-memory schedule manager
export async function registerScheduleApi(scheduleData) {
  const res = await fetch(`${API_BASE_URL}/api/v1/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scheduleData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to register schedule');
  return data;
}

// Updates cron expression, timezone, or trigger configuration for an existing schedule
export async function updateScheduleApi(id, updates) {
  const res = await fetch(`${API_BASE_URL}/api/v1/schedules/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update schedule');
  return data;
}

// Enables or pauses an active schedule task
export async function toggleScheduleApi(id, enabled) {
  const res = await fetch(`${API_BASE_URL}/api/v1/schedules/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to toggle schedule');
  return data;
}

// Removes a schedule and stops its underlying cron task
export async function deleteScheduleApi(id) {
  const res = await fetch(`${API_BASE_URL}/api/v1/schedules/${id}`, {
    method: 'DELETE',
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete schedule');
  return data;
}

// Manually triggers an immediate execution of a scheduled workflow
export async function runScheduleNowApi(id) {
  const res = await fetch(`${API_BASE_URL}/api/v1/schedules/${id}/run`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to trigger schedule execution');
  return data;
}

