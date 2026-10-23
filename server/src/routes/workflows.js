import { nanoid } from 'nanoid';
import { memoryStore } from '../store/memoryStore.js';
import { runKahnsAlgorithm } from '../engine/kahnsAlgorithm.js';
import { executeWorkflow } from '../engine/executor.js';

export async function workflowRoutes(fastify) {
  // List all workflows
  fastify.get('/api/v1/workflows', async () => {
    return {
      success: true,
      workflows: memoryStore.listWorkflows(),
    };
  });

  // Get single workflow
  fastify.get('/api/v1/workflows/:id', async (request, reply) => {
    const workflow = memoryStore.getWorkflow(request.params.id);
    if (!workflow) {
      return reply.code(404).send({ success: false, error: 'Workflow not found' });
    }
    return { success: true, workflow };
  });

  // Save / create workflow with Kahn's Algorithm validation
  fastify.post('/api/v1/workflows', async (request, reply) => {
    const { id, name = 'Untitled Workflow', nodes = [], edges = [] } = request.body || {};

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
    const saved = memoryStore.saveWorkflow({
      id: workflowId,
      name,
      nodes,
      edges,
    });

    return reply.code(201).send({
      success: true,
      workflow: saved,
      topologicalOrder: validation.topologicalOrder.map((n) => n.id),
    });
  });

  // Delete single workflow
  fastify.delete('/api/v1/workflows/:id', async (request, reply) => {
    const deleted = memoryStore.deleteWorkflow(request.params.id);
    if (!deleted) {
      return reply.code(404).send({ success: false, error: 'Workflow not found' });
    }
    return { success: true, message: 'Workflow deleted successfully' };
  });

  // Trigger manual execution (<10ms Fast Ack)
  fastify.post('/api/v1/workflows/:id/execute', async (request, reply) => {
    const { id } = request.params;
    const body = request.body || {};
    let workflow = memoryStore.getWorkflow(id);

    // If client provided updated nodes/edges directly with execute call, update workflow
    if (body.nodes && Array.isArray(body.nodes)) {
      const validation = runKahnsAlgorithm(body.nodes, body.edges || []);
      if (!validation.isValid) {
        return reply.code(400).send({
          success: false,
          error: validation.error,
          cycleNodes: validation.cycleNodes,
        });
      }

      workflow = memoryStore.saveWorkflow({
        id,
        name: body.name || workflow?.name || 'Untitled Workflow',
        nodes: body.nodes,
        edges: body.edges || [],
      });
    }

    if (!workflow) {
      return reply.code(404).send({ success: false, error: 'Workflow not found' });
    }

    const executionId = `exec_${nanoid(8)}`;
    memoryStore.createExecution({
      id: executionId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      triggerPayload: body.triggerPayload || body,
    });

    // Run asynchronously in the background so HTTP response is instant (<10ms)
    setImmediate(() => {
      executeWorkflow(workflow, executionId, body.triggerPayload || body);
    });

    return reply.code(202).send({
      success: true,
      executionId,
      status: 'PENDING',
      enqueuedAt: new Date().toISOString(),
    });
  });

  // List executions (optionally by workflow)
  fastify.get('/api/v1/executions', async (request) => {
    const { workflowId } = request.query || {};
    const executions = memoryStore.listExecutions(workflowId);
    return {
      success: true,
      executions,
    };
  });

  // Clear execution history
  fastify.delete('/api/v1/executions', async () => {
    memoryStore.clearExecutions();
    return { success: true, message: 'Execution history cleared' };
  });

  // Get execution details and logs
  fastify.get('/api/v1/executions/:id', async (request, reply) => {
    const execution = memoryStore.getExecution(request.params.id);
    if (!execution) {
      return reply.code(404).send({ success: false, error: 'Execution not found' });
    }
    return { success: true, execution };
  });
}
