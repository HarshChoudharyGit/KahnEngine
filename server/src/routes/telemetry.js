import { memoryStore } from '../store/memoryStore.js';
import { getExecution } from '../db/workflowRepository.js';

export async function telemetryRoutes(fastify) {
  // SSE stream endpoint for real-time node state and log streaming
  fastify.get('/api/v1/telemetry/stream/:executionId', async (request, reply) => {
    const { executionId } = request.params;

    // Set Server-Sent Events headers
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.flushHeaders?.();

    // Register subscriber early so no live events are missed during DB await
    memoryStore.addSubscriber(executionId, reply);

    // Handle client disconnect
    request.raw.on('close', () => {
      memoryStore.removeSubscriber(executionId, reply);
    });

    const execution = await getExecution(executionId);

    // Send initial connection acknowledgement and current execution state
    reply.raw.write(
      `event: connected\ndata: ${JSON.stringify({
        executionId,
        status: execution ? execution.status : 'UNKNOWN',
        nodeStatuses: execution ? execution.nodeStatuses : {},
      })}\n\n`
    );

    if (execution) {
      // Replay all node statuses
      for (const [nodeId, status] of Object.entries(execution.nodeStatuses || {})) {
        reply.raw.write(
          `event: node_status\ndata: ${JSON.stringify({ nodeId, status, timestamp: Date.now() })}\n\n`
        );
      }

      // If historical logs already exist, replay them to the client
      if (execution.logs && execution.logs.length > 0) {
        for (const log of execution.logs) {
          reply.raw.write(`event: node_log\ndata: ${JSON.stringify(log)}\n\n`);
        }
      }

      // If execution is already done, emit terminal event
      const normStatus = String(execution.status || '').toUpperCase();
      if (normStatus === 'SUCCESS' || normStatus === 'COMPLETED') {
        reply.raw.write(
          `event: execution_completed\ndata: ${JSON.stringify({
            executionId,
            status: 'SUCCESS',
            durationMs: execution.durationMs,
          })}\n\n`
        );
      } else if (normStatus === 'FAILED') {
        reply.raw.write(
          `event: execution_failed\ndata: ${JSON.stringify({
            executionId,
            status: 'FAILED',
            error: execution.error,
          })}\n\n`
        );
      }
    }
  });
}
