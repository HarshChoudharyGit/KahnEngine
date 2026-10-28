import { nanoid } from 'nanoid';
import {
  clearExecutions,
  createExecution,
  deleteAllWorkflows,
  deleteWorkflow,
  getExecution,
  getWorkflow,
  listExecutions,
  listWorkflows,
  saveWorkflow,
  saveWorkflowAndCreateExecution,
} from '../db/workflowRepository.js';
import { runKahnsAlgorithm } from '../engine/kahnsAlgorithm.js';
import { executeWorkflow } from '../engine/executor.js';
import { validateNodeConfigurations } from '../engine/nodeConfigurationValidation.js';

function pagination(query = {}) {
  const limit = Number(query.limit ?? 100);
  const offset = Number(query.offset ?? 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isInteger(offset) || offset < 0) {
    return null;
  }
  return { limit, offset };
}

function isValidGraphInput(nodes, edges) {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return false;
  const nodeIds = new Set();
  for (const node of nodes) {
    if (!node || typeof node !== 'object' || Array.isArray(node) ||
        typeof node.id !== 'string' || !node.id.trim() || node.id.length > 255 || nodeIds.has(node.id) ||
        (node.data !== undefined && (!node.data || typeof node.data !== 'object' || Array.isArray(node.data))) ||
        (node.data?.configuration !== undefined &&
          (!node.data.configuration || typeof node.data.configuration !== 'object' || Array.isArray(node.data.configuration)))) {
      return false;
    }
    const nodeType = String(node.data?.configType || node.type || '').toLowerCase();
    const configuration = node.data?.configuration || node.data || {};
    const cronSchedule = configuration.schedule || configuration.cronExpression;
    if (['crontrigger', 'cron', 'scheduletrigger'].includes(nodeType) && cronSchedule) {
      if (typeof cronSchedule !== 'string' || cronSchedule.length > 100) {
        return false;
      }
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: configuration.timezone || 'UTC' });
      } catch {
        return false;
      }
    }
    nodeIds.add(node.id);
  }
  return edges.every((edge) =>
    edge && typeof edge === 'object' && !Array.isArray(edge) &&
    typeof edge.source === 'string' && nodeIds.has(edge.source) &&
    typeof edge.target === 'string' && nodeIds.has(edge.target)
  );
}

export async function workflowRoutes(fastify) {
  // List all workflows
  fastify.get('/api/v1/workflows', async (request, reply) => {
    const page = pagination(request.query);
    if (!page) {
      return reply.code(400).send({ success: false, error: 'limit must be 1-100 and offset must be a non-negative integer.' });
    }
    return {
      success: true,
      workflows: await listWorkflows(page),
    };
  });

  // Get single workflow
  fastify.get('/api/v1/workflows/:id', async (request, reply) => {
    const workflow = await getWorkflow(request.params.id);
    if (!workflow) {
      return reply.code(404).send({ success: false, error: 'Workflow not found' });
    }
    return { success: true, workflow };
  });

  // Save / create workflow with Kahn's Algorithm validation
  fastify.post('/api/v1/workflows', async (request, reply) => {
    const body = request.body || {};
    const { id, name = 'Untitled Workflow', description = null, status = 'active', nodes = [], edges = [] } = body;

    if ((id !== undefined && (typeof id !== 'string' || !id.trim())) ||
        typeof name !== 'string' || !name.trim() || name.length > 255 ||
        (description !== null && typeof description !== 'string') ||
        !isValidGraphInput(nodes, edges)) {
      return reply.code(400).send({ success: false, error: 'Workflow id and name must be valid strings, description must be a string, nodes require unique string ids, and edges must reference existing nodes.' });
    }

    // Validate graph using Kahn's algorithm
    const validation = runKahnsAlgorithm(nodes, edges);
    if (!validation.isValid) {
      return reply.code(400).send({
        success: false,
        error: validation.error,
        cycleNodes: validation.cycleNodes,
      });
    }

    const workflowId = id || `wf_${nanoid(8)}`;
    const saved = await saveWorkflow({
      id: workflowId,
      name,
      description,
      status,
      nodes,
      edges,
    });

    return reply.code(201).send({
      success: true,
      workflow: saved,
      topologicalOrder: validation.topologicalOrder.map((n) => n.id),
    });
  });

  // Delete all workflows
  fastify.delete('/api/v1/workflows', async (request, reply) => {
    try {
      const count = await deleteAllWorkflows();
      return { success: true, message: `Deleted ${count} workflows successfully`, count };
    } catch (err) {
      request.log.error({ err }, 'Failed to delete all workflows');
      return reply.code(500).send({ success: false, error: err.message || 'Failed to delete all workflows' });
    }
  });

  // Delete single workflow
  fastify.delete('/api/v1/workflows/:id', async (request, reply) => {
    try {
      const deleted = await deleteWorkflow(request.params.id);
      if (!deleted) {
        return reply.code(404).send({ success: false, error: 'Workflow not found' });
      }
      return { success: true, message: 'Workflow deleted successfully' };
    } catch (err) {
      request.log.error({ err, workflowId: request.params.id }, 'Failed to delete workflow');
      return reply.code(500).send({ success: false, error: err.message || 'Failed to delete workflow' });
    }
  });

  // Validate and dispatch a manual workflow execution.
  fastify.post('/api/v1/workflows/:id/execute', async (request, reply) => {
    const { id } = request.params;
    const body = request.body || {};
    let workflow = await getWorkflow(id);
    let workflowToPersist = null;

    // If client provided updated nodes/edges directly with execute call, update workflow
    if (body.nodes !== undefined) {
      const edges = body.edges || [];
      if (!isValidGraphInput(body.nodes, edges)) {
        return reply.code(400).send({ success: false, error: 'Nodes require unique string ids, and edges must reference existing nodes.' });
      }
      const name = body.name || workflow?.name || 'Untitled Workflow';
      if (typeof name !== 'string' || !name.trim() || name.length > 255) {
        return reply.code(400).send({ success: false, error: 'Workflow name must be a non-empty string of at most 255 characters.' });
      }
      const validation = runKahnsAlgorithm(body.nodes, edges);
      if (!validation.isValid) {
        return reply.code(400).send({
          success: false,
          error: validation.error,
          cycleNodes: validation.cycleNodes,
        });
      }

      workflowToPersist = {
        id,
        name,
        description: workflow?.description,
        status: workflow?.status || 'active',
        nodes: body.nodes,
        edges,
      };
      workflow = workflowToPersist;
    }

    if (!workflow) {
      return reply.code(404).send({ success: false, error: 'Workflow not found' });
    }

    if (!isValidGraphInput(workflow.nodes, workflow.edges)) {
      return reply.code(400).send({ success: false, error: 'Workflow nodes or edges are invalid.' });
    }
    const validation = runKahnsAlgorithm(workflow.nodes, workflow.edges);
    if (!validation.isValid) {
      return reply.code(400).send({
        success: false,
        error: validation.error,
        cycleNodes: validation.cycleNodes,
      });
    }
    const configurationErrors = validateNodeConfigurations(workflow.nodes);
    if (configurationErrors.length > 0) {
      return reply.code(400).send({
        success: false,
        error: 'One or more workflow nodes are not configured correctly.',
        nodeErrors: configurationErrors,
      });
    }

    const executionId = `exec_${nanoid(8)}`;
    const executionRecord = {
      id: executionId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      triggerPayload: body.triggerPayload || body,
    };
    if (workflowToPersist) {
      const result = await saveWorkflowAndCreateExecution(workflowToPersist, executionRecord);
      workflow = result.workflow;
    } else {
      await createExecution(executionRecord);
    }

    // Run asynchronously in the API process after the response is prepared.
    setImmediate(() => {
      void executeWorkflow(workflow, executionId, body.triggerPayload || body)
        .catch((err) => fastify.log.error({ err, executionId }, 'Workflow execution failed unexpectedly'));
    });

    return reply.code(202).send({
      success: true,
      executionId,
      status: 'PENDING',
      enqueuedAt: new Date().toISOString(),
    });
  });

  // List executions (optionally by workflow)
  fastify.get('/api/v1/executions', async (request, reply) => {
    const query = request.query || {};
    const page = pagination(query);
    if (!page) {
      return reply.code(400).send({ success: false, error: 'limit must be 1-100 and offset must be a non-negative integer.' });
    }
    const workflowId = query.workflowId || null;
    const executions = await listExecutions({ ...page, workflowId });
    return {
      success: true,
      executions,
    };
  });

  // Clear execution history
  fastify.delete('/api/v1/executions', async () => {
    await clearExecutions();
    return { success: true, message: 'Execution history cleared' };
  });

  // Get execution details and logs
  fastify.get('/api/v1/executions/:id', async (request, reply) => {
    const execution = await getExecution(request.params.id);
    if (!execution) {
      return reply.code(404).send({ success: false, error: 'Execution not found' });
    }
    return { success: true, execution };
  });

  // HTTP Test proxy to allow testing external endpoints from the frontend without browser CORS limitations
  fastify.post('/api/v1/test-http', async (request, reply) => {
    const { url, method = 'GET', headers = {}, body } = request.body || {};
    if (!url || typeof url !== 'string') {
      return reply.code(400).send({ success: false, error: 'URL is required' });
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: String(method).toUpperCase(),
        headers,
        body: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method).toUpperCase()) && body ? body : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const durationMs = Date.now() - startTime;
      const text = await response.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }

      return reply.send({
        success: true,
        status: response.status,
        statusText: response.statusText,
        durationMs,
        headers: Object.fromEntries(response.headers.entries()),
        data: parsed,
      });
    } catch (err) {
      clearTimeout(timeout);
      const durationMs = Date.now() - startTime;
      return reply.code(502).send({
        success: false,
        error: err.name === 'AbortError' ? 'Request timed out after 10s' : err.message,
        durationMs,
      });
    }
  });
}
