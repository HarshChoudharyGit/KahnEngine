const EXECUTION_STORAGE_KEY = 'dormammu-loop-executions'
const MAX_EXECUTION_HISTORY = 50
const DEMO_EXECUTION_STEP_DELAY_MS = 520

function isExecutionRecord(record) {
  return record
    && typeof record.id === 'string'
    && ['running', 'complete', 'interrupted'].includes(record.status)
    && typeof record.startedAt === 'string'
    && Number.isFinite(record.nodeCount)
    && Array.isArray(record.steps)
}

function loadExecutionHistory() {
  const storedExecutions = window.localStorage.getItem(EXECUTION_STORAGE_KEY)
  if (!storedExecutions) return []

  const parsedExecutions = JSON.parse(storedExecutions)
  if (!Array.isArray(parsedExecutions) || !parsedExecutions.every(isExecutionRecord)) {
    throw new Error('Saved execution history has an unexpected format.')
  }

  return parsedExecutions.map((execution) =>
    execution.status === 'running'
      ? { ...execution, status: 'interrupted', finishedAt: new Date().toISOString() }
      : execution,
  ).slice(0, MAX_EXECUTION_HISTORY)
}

function saveExecutionHistory(executions) {
  window.localStorage.setItem(EXECUTION_STORAGE_KEY, JSON.stringify(executions))
}

function createDemoExecution(nodes) {
  const startedAtMs = Date.now()
  const snapshot = nodes.map((node) => ({
    id: node.id,
    data: { title: node.data.title, category: node.data.category },
  }))

  return {
    snapshot,
    startedAtMs,
    record: {
      id: `execution-${startedAtMs}`,
      status: 'running',
      startedAt: new Date(startedAtMs).toISOString(),
      finishedAt: null,
      durationMs: null,
      nodeCount: snapshot.length,
      steps: [],
    },
  }
}

function recordDemoExecutionStep(executions, executionId, node) {
  const completedAt = new Date().toISOString()

  return executions.map((execution) =>
    execution.id === executionId
      ? {
          ...execution,
          steps: [
            ...execution.steps,
            {
              nodeId: node.id,
              title: node.data.title,
              category: node.data.category,
              completedAt,
              durationMs: DEMO_EXECUTION_STEP_DELAY_MS,
            },
          ],
        }
      : execution,
  )
}

function completeDemoExecution(executions, executionId, startedAtMs) {
  return executions.map((execution) =>
    execution.id === executionId
      ? {
          ...execution,
          status: 'complete',
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAtMs,
        }
      : execution,
  )
}

function addExecutionToHistory(executions, execution) {
  return [execution, ...executions.filter(({ id }) => id !== execution.id)]
    .slice(0, MAX_EXECUTION_HISTORY)
}

export {
  DEMO_EXECUTION_STEP_DELAY_MS,
  addExecutionToHistory,
  completeDemoExecution,
  createDemoExecution,
  loadExecutionHistory,
  recordDemoExecutionStep,
  saveExecutionHistory,
}
