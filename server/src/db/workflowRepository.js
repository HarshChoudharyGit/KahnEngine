import { pool } from './db.js';

// Matches standard RFC 4122 UUID strings
const UUID_PATTERN = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;

// Returns client-facing ID, preferring legacy string ID over database UUID
function publicId(row) {
  return row.legacy_id || row.id;
}

// Formats a database workflow row into a client-facing workflow object
function mapWorkflow(row) {
  if (!row) return null;
  return {
    id: publicId(row),
    name: row.name,
    description: row.description,
    status: row.status,
    version: row.version,
    nodes: row.definition.nodes || [],
    edges: row.definition.edges || [],
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// Maps internal DB execution statuses to public API status strings
function externalExecutionStatus(status) {
  return {
    queued: 'PENDING',
    running: 'RUNNING',
    completed: 'SUCCESS',
    failed: 'FAILED',
    cancelled: 'FAILED',
  }[status] || status.toUpperCase();
}

// Maps internal node execution statuses to public API status strings
function externalNodeStatus(status) {
  return {
    pending: 'PENDING',
    queued: 'PENDING',
    running: 'RUNNING',
    completed: 'SUCCESS',
    failed: 'FAILED',
    skipped: 'SKIPPED',
  }[status] || status.toUpperCase();
}

// Formats execution record with its associated node steps and sanitized logs
function mapExecution(row, nodeRows = [], logRows = []) {
  if (!row) return null;
  const nodeStatuses = {};
  const steps = nodeRows.map((node) => {
    nodeStatuses[node.node_id] = externalNodeStatus(node.status);
    return {
      nodeId: node.node_id,
      title: node.input?.nodeTitle || node.node_id,
      category: node.node_type,
      status: externalNodeStatus(node.status),
      ...(node.output !== null ? { output: node.output } : {}),
      ...(node.error ? { error: node.error } : {}),
      completedAt: node.finished_at ? new Date(node.finished_at).toISOString() : null,
      durationMs: node.started_at && node.finished_at
        ? new Date(node.finished_at).getTime() - new Date(node.started_at).getTime()
        : null,
    };
  });
  return {
    id: publicId(row),
    workflowId: row.workflow_legacy_id || row.workflow_id,
    workflowName: row.workflow_name,
    triggerPayload: row.trigger_data,
    status: externalExecutionStatus(row.status),
    nodeStatuses,
    logs: logRows.map((log) => ({
      ...log.metadata,
      level: log.level.toUpperCase(),
      message: log.message,
      timestamp: new Date(log.created_at).getTime(),
    })),
    steps,
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : new Date(row.created_at).toISOString(),
    completedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
    durationMs: row.started_at && row.finished_at
      ? new Date(row.finished_at).getTime() - new Date(row.started_at).getTime()
      : null,
    ...(row.error ? { error: row.error } : {}),
  };
}

// Finds a workflow by legacy string ID or UUID, optionally locking the row FOR UPDATE
async function selectWorkflow(client, id, forUpdate = false) {
  const { rows } = await client.query(
    `SELECT * FROM workflows WHERE legacy_id = $1 OR id::text = $1
     ORDER BY (legacy_id = $1) DESC NULLS LAST LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [id],
  );
  return rows[0] || null;
}

// Serializes workflow nodes and edges into JSON string for DB storage
function workflowDefinition(workflow) {
  return JSON.stringify({
    ...(workflow.definition || {}),
    nodes: workflow.nodes || [],
    edges: workflow.edges || [],
  });
}

// Extracts cron trigger nodes and syncs active schedules in workflow_schedules table
async function syncSchedules(client, workflowId, nodes) {
  const scheduled = [];
  for (const node of nodes) {
    const type = String(node?.data?.configType || node?.type || '').toLowerCase();
    const configuration = node?.data?.configuration || node?.data || {};
    if (!['crontrigger', 'cron'].includes(type) || !node.id || !configuration.schedule) continue;
    const timezone = configuration.timezone || 'UTC';
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
      throw new Error(`Invalid timezone "${timezone}" in schedule node "${node.id}"`);
    }
    scheduled.push({ nodeId: node.id, cronExpression: configuration.schedule, timezone });
  }

  // Insert or update configured schedules
  for (const schedule of scheduled) {
    await client.query(
      `INSERT INTO workflow_schedules (workflow_id, node_id, cron_expression, timezone)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (workflow_id, node_id) DO UPDATE SET
         cron_expression = EXCLUDED.cron_expression,
         timezone = EXCLUDED.timezone,
         enabled = true,
         updated_at = now()`,
      [workflowId, schedule.nodeId, schedule.cronExpression, schedule.timezone],
    );
  }

  // Remove deleted or decommissioned schedules
  const nodeIds = scheduled.map((schedule) => schedule.nodeId);
  await client.query(
    `DELETE FROM workflow_schedules
     WHERE workflow_id = $1 AND NOT (node_id = ANY($2::text[]))`,
    [workflowId, nodeIds],
  );
}

// Inserts a new workflow or updates an existing one, auto-incrementing version on changes
async function upsertWorkflow(client, workflow) {
  const existing = await selectWorkflow(client, workflow.id, true);
  const definition = workflowDefinition(workflow);
  let result;
  if (existing) {
    const updated = await client.query(
      `UPDATE workflows SET
         name = $2::varchar(255),
         description = coalesce($3, description),
         definition = $4::jsonb,
         version = CASE WHEN name IS DISTINCT FROM $2::varchar(255) OR definition IS DISTINCT FROM $4::jsonb
                        THEN version + 1 ELSE version END,
         updated_at = CASE WHEN name IS DISTINCT FROM $2::varchar(255) OR definition IS DISTINCT FROM $4::jsonb
                           THEN now() ELSE updated_at END
       WHERE id = $1 RETURNING *`,
      [existing.id, workflow.name, workflow.description || null, definition],
    );
    result = updated.rows[0];
  } else {
    const generatedId = UUID_PATTERN.test(workflow.id) ? workflow.id : null;
    const inserted = await client.query(
      `INSERT INTO workflows (id, legacy_id, name, description, definition)
       VALUES (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, $5::jsonb)
       RETURNING *`,
      [
        generatedId,
        generatedId ? null : workflow.id,
        workflow.name,
        workflow.description || null,
        definition,
      ],
    );
    result = inserted.rows[0];
  }
  await syncSchedules(client, result.id, workflow.nodes || []);
  return result;
}

// Determines execution trigger source based on payload properties
function inferTriggerType(payload = {}) {
  if (payload.source === 'github-poller') return 'github_webhook';
  if (payload.source === 'schedule' || payload.triggerType === 'schedule') return 'schedule';
  if (payload.event === 'push' && payload.repository) return 'github_webhook';
  if (payload.triggerType) return String(payload.triggerType).slice(0, 50);
  return 'manual';
}

// Inserts a new workflow execution row inside an active client transaction
async function insertExecution(client, record) {
  const workflow = await selectWorkflow(client, record.workflowId);
  if (!workflow) throw new Error(`Workflow "${record.workflowId}" does not exist`);
  const generatedId = UUID_PATTERN.test(record.id) ? record.id : null;
  const { rows } = await client.query(
    `INSERT INTO workflow_executions
       (id, legacy_id, workflow_id, workflow_version, trigger_type, trigger_data)
     VALUES (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6::jsonb)
     RETURNING *`,
    [
      generatedId,
      generatedId ? null : record.id,
      workflow.id,
      workflow.version,
      inferTriggerType(record.triggerPayload),
      JSON.stringify(record.triggerPayload || {}),
    ],
  );
  return rows[0];
}

// Batch queries node execution and log rows for an array of execution UUIDs
async function executionRows(ids) {
  if (!ids.length) return { nodeRows: [], logRows: [] };
  const [nodes, logs] = await Promise.all([
    pool.query(
      `SELECT n.*, n.node_type AS node_title FROM node_executions n
       WHERE n.execution_id = ANY($1::uuid[]) ORDER BY n.created_at`,
      [ids],
    ),
    pool.query(
      `SELECT * FROM execution_logs
       WHERE execution_id = ANY($1::uuid[]) ORDER BY created_at`,
      [ids],
    ),
  ]);
  return { nodeRows: nodes.rows, logRows: logs.rows };
}

// Maps multiple DB execution rows together with their corresponding node steps and logs
function mapExecutions(rows, nodeRows, logRows) {
  return rows.map((row) => mapExecution(
    row,
    nodeRows.filter((node) => node.execution_id === row.id),
    logRows.filter((log) => log.execution_id === row.id),
  ));
}

// Creates or updates a workflow in a database transaction
export async function saveWorkflow(workflow) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await upsertWorkflow(client, workflow);
    await client.query('COMMIT');
    return mapWorkflow(result);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Retrieves a single workflow by legacy ID or UUID
export async function getWorkflow(id) {
  const row = await selectWorkflow(pool, id);
  return mapWorkflow(row);
}

// Returns a paginated list of workflows ordered by recent update
export async function listWorkflows({ limit = 100, offset = 0 } = {}) {
  const { rows } = await pool.query(
    'SELECT * FROM workflows ORDER BY updated_at DESC LIMIT $1 OFFSET $2',
    [limit, offset],
  );
  return rows.map(mapWorkflow);
}

// Retrieves all workflows across all pages
export async function listAllWorkflows() {
  const workflows = [];
  for (let offset = 0; ; offset += 100) {
    const page = await listWorkflows({ limit: 100, offset });
    workflows.push(...page);
    if (page.length < 100) return workflows;
  }
}

// Deletes a workflow by legacy ID or UUID and cascades associated executions and schedules
export async function deleteWorkflow(id) {
  const row = await selectWorkflow(pool, id);
  if (!row) return false;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM workflow_executions WHERE workflow_id = $1', [row.id]);
    await client.query('DELETE FROM workflow_schedules WHERE workflow_id = $1', [row.id]);
    const { rowCount } = await client.query('DELETE FROM workflows WHERE id = $1', [row.id]);
    await client.query('COMMIT');
    return rowCount > 0;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Creates a new execution record for a workflow
export async function createExecution(record) {
  const { rows } = await pool.query(
    `WITH workflow AS (
       SELECT id, version FROM workflows
       WHERE legacy_id = $1 OR id::text = $1
       ORDER BY (legacy_id = $1) DESC NULLS LAST LIMIT 1
     )
     INSERT INTO workflow_executions
       (id, legacy_id, workflow_id, workflow_version, trigger_type, trigger_data)
     SELECT coalesce($2::uuid, gen_random_uuid()), $3, workflow.id, workflow.version, $4, $5::jsonb
     FROM workflow
     RETURNING *`,
    [
      record.workflowId,
      UUID_PATTERN.test(record.id) ? record.id : null,
      UUID_PATTERN.test(record.id) ? null : record.id,
      inferTriggerType(record.triggerPayload),
      JSON.stringify(record.triggerPayload || {}),
    ],
  );
  if (!rows[0]) throw new Error(`Workflow "${record.workflowId}" does not exist`);
  return { ...mapExecution(rows[0]), workflowName: record.workflowName };
}

// Atomically persists a workflow and creates an execution for it
export async function saveWorkflowAndCreateExecution(workflow, record) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const savedWorkflow = await upsertWorkflow(client, workflow);
    const execution = await insertExecution(client, {
      ...record,
      workflowId: savedWorkflow.legacy_id || savedWorkflow.id,
    });
    await client.query('COMMIT');
    return {
      workflow: mapWorkflow(savedWorkflow),
      execution: { ...mapExecution(execution), workflowName: savedWorkflow.name },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Internal query helper to fetch single execution row joined with workflow info
async function getExecutionRows(where, params) {
  const { rows } = await pool.query(
    `SELECT e.*, w.name AS workflow_name, w.legacy_id AS workflow_legacy_id
     FROM workflow_executions e
     JOIN workflows w ON w.id = e.workflow_id
     WHERE ${where} LIMIT 1`,
    params,
  );
  return rows;
}

// Fetches an execution by ID including its node execution steps and logs
export async function getExecution(id) {
  const rows = await getExecutionRows('e.legacy_id = $1 OR e.id::text = $1', [id]);
  if (!rows[0]) return null;
  const { nodeRows, logRows } = await executionRows([rows[0].id]);
  return mapExecution(rows[0], nodeRows, logRows);
}

// Lists executions optionally filtered by workflowId with node steps and logs
export async function listExecutions({ workflowId = null, limit = 100, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT e.*, w.name AS workflow_name, w.legacy_id AS workflow_legacy_id
     FROM workflow_executions e
     JOIN workflows w ON w.id = e.workflow_id
     WHERE ($1::text IS NULL OR w.legacy_id = $1 OR w.id::text = $1)
     ORDER BY e.created_at DESC
     LIMIT $2 OFFSET $3`,
    [workflowId, limit, offset],
  );
  const { nodeRows, logRows } = await executionRows(rows.map((row) => row.id));
  return mapExecutions(rows, nodeRows, logRows);
}

// Deletes all workflow execution history
export async function clearExecutions() {
  const { rowCount } = await pool.query('DELETE FROM workflow_executions');
  return rowCount;
}

// Updates execution status, timestamps, trigger payload, or error message
export async function updateExecution(id, partial) {
  const fields = [];
  const values = [id];
  if (Object.hasOwn(partial, 'status')) {
    const status = {
      PENDING: 'queued',
      RUNNING: 'running',
      SUCCESS: 'completed',
      FAILED: 'failed',
      CANCELLED: 'cancelled',
    }[partial.status] || partial.status;
    values.push(status);
    fields.push(`status = $${values.length}::varchar(20)`);
    fields.push(`started_at = CASE WHEN $${values.length}::varchar(20) = 'running' THEN coalesce(started_at, now()) ELSE started_at END`);
    fields.push(`finished_at = CASE WHEN $${values.length}::varchar(20) IN ('completed', 'failed', 'cancelled') THEN coalesce($${values.length + 1}::timestamptz, now()) ELSE finished_at END`);
    values.push(partial.completedAt || null);
  }
  if (Object.hasOwn(partial, 'triggerPayload')) {
    values.push(JSON.stringify(partial.triggerPayload || {}));
    fields.push(`trigger_data = $${values.length}::jsonb`);
  }
  if (Object.hasOwn(partial, 'error')) {
    values.push(partial.error);
    fields.push(`error = $${values.length}`);
  }
  if (fields.length === 0) return getExecution(id);
  const { rows } = await pool.query(
    `UPDATE workflow_executions SET ${fields.join(', ')}
     WHERE legacy_id = $1 OR id::text = $1 RETURNING *`,
    values,
  );
  return rows[0] ? getExecution(id) : null;
}

// Marks execution as running and initializes pending records for all workflow nodes
export async function startExecution(executionId, nodes) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE workflow_executions SET status = 'running', started_at = coalesce(started_at, now())
       WHERE legacy_id = $1 OR id::text = $1 RETURNING id`,
      [executionId],
    );
    if (!updated.rows[0]) throw new Error(`Execution "${executionId}" does not exist`);
    await client.query(
      `INSERT INTO node_executions (execution_id, node_id, node_type, status)
       SELECT $1, node.id, coalesce(node.type, 'unknown'), 'pending'
       FROM jsonb_to_recordset($2::jsonb) AS node(id text, type text)
       ON CONFLICT (execution_id, node_id, attempt) DO NOTHING`,
      [updated.rows[0].id, JSON.stringify(nodes.map((node) => ({
        id: node.id,
        type: node.data?.configType || node.data?.type || node.type || 'unknown',
      })))],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Records start of an individual node execution with its input payload
export async function startNodeExecution(executionId, { nodeId, nodeType, input }) {
  const { rows } = await pool.query(
    `INSERT INTO node_executions
       (execution_id, node_id, node_type, status, input, started_at)
     SELECT e.id, $2, $3, 'running', $4::jsonb, now()
     FROM workflow_executions e WHERE e.legacy_id = $1 OR e.id::text = $1
     ON CONFLICT (execution_id, node_id, attempt) DO UPDATE SET
       status = 'running', input = EXCLUDED.input, started_at = now(),
       finished_at = NULL, output = NULL, error = NULL
     RETURNING id`,
    [executionId, nodeId, nodeType || 'unknown', JSON.stringify(input ?? null)],
  );
  if (!rows[0]) throw new Error(`Execution "${executionId}" does not exist`);
}

// Records completion or failure of a node execution with its output/error
export async function finishNodeExecution(executionId, { nodeId, status, output, error }) {
  const result = await pool.query(
    `UPDATE node_executions n SET
       status = $3, output = $4::jsonb, error = $5, finished_at = now()
     FROM workflow_executions e
     WHERE n.execution_id = e.id AND (e.legacy_id = $1 OR e.id::text = $1)
       AND n.node_id = $2 AND n.attempt = 1`,
    [executionId, nodeId, status, JSON.stringify(output ?? null), error || null],
  );
  if (!result.rowCount) throw new Error(`Node execution "${nodeId}" was not started`);
}

// Appends a sanitized log message associated with an execution (and optional node)
export async function appendLog(executionId, logEntry) {
  const sanitized = sanitizeLogEntry(logEntry);
  const metadata = { ...sanitized };
  delete metadata.message;
  delete metadata.level;
  const level = ({
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    WARNING: 'warn',
    ERROR: 'error',
  })[String(logEntry.level || 'INFO').toUpperCase()] || 'info';
  const createdAt = typeof logEntry.timestamp === 'number'
    ? new Date(logEntry.timestamp).toISOString()
    : logEntry.timestamp || new Date().toISOString();
  const message = sanitized.message;
  const { rowCount } = await pool.query(
    `INSERT INTO execution_logs (execution_id, node_execution_id, level, message, metadata, created_at)
     SELECT e.id, n.id, $3, $4, $5::jsonb, $6::timestamptz
     FROM workflow_executions e
     LEFT JOIN node_executions n ON n.execution_id = e.id AND n.node_id = $2 AND n.attempt = 1
     WHERE e.legacy_id = $1 OR e.id::text = $1`,
    [executionId, logEntry.nodeId || null, level, message, JSON.stringify(metadata), createdAt],
  );
  if (!rowCount) throw new Error(`Execution "${executionId}" does not exist`);
}

// Redacts sensitive keys and auth tokens from log entries before persistence
export function sanitizeLogEntry(logEntry) {
  const sanitized = {};
  for (const [key, value] of Object.entries(logEntry)) {
    if (/token|secret|password|authorization|credential/i.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      sanitized[key] = value
        .replace(/\bBearer\s+[A-Za-z\d._~+/-]+=*/gi, 'Bearer [REDACTED]')
        .replace(/\b(access_token|refresh_token|client_secret|password)\s*[:=]\s*[^&\s,;]+/gi, '$1=[REDACTED]');
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// Stores or updates OAuth / API connection credentials and status for a provider
export async function upsertIntegrationConnection(provider, accountName, status, scopes = []) {
  await pool.query(
    `INSERT INTO integration_connections (provider, account_name, status, scopes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (provider) DO UPDATE SET
       account_name = EXCLUDED.account_name, status = EXCLUDED.status,
       scopes = EXCLUDED.scopes, updated_at = now()`,
    [provider, accountName || null, status, scopes],
  );
}

