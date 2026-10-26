import { nanoid } from 'nanoid';
import { createExecution, getWorkflow, listAllWorkflows } from '../db/workflowRepository.js';
import { executeWorkflow } from '../engine/executor.js';
import {
  pollGitHubOnce,
  simulateCommitPush,
  getWatcherStatus,
  triggerCommitWorkflow,
} from '../services/githubWatcher.js';

export async function webhookRoutes(fastify) {
  fastify.post('/api/v1/webhooks/:workflowId', async (request, reply) => {
    const { workflowId } = request.params;
    const workflow = await getWorkflow(workflowId);

    if (!workflow) {
      return reply.code(404).send({
        success: false,
        error: `Workflow with ID '${workflowId}' not found.`,
      });
    }

    const executionId = `exec_${nanoid(8)}`;
    await createExecution({
      id: executionId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      triggerPayload: request.body || {},
    });

    setImmediate(() => {
      void executeWorkflow(workflow, executionId, request.body || {})
        .catch((err) => fastify.log.error({ err, executionId }, 'Webhook workflow execution failed unexpectedly'));
    });

    return reply.code(202).send({
      success: true,
      executionId,
      status: 'PENDING',
      enqueuedAt: new Date().toISOString(),
    });
  });

  fastify.post('/api/v1/webhooks/github', async (request, reply) => {
    const payload = request.body || {};
    const repo = payload.repository?.full_name || 'HarshChoudharyGit/KahnEngine';
    const headCommit = payload.head_commit || payload.commits?.[0];
    const branch = payload.ref ? payload.ref.replace('refs/heads/', '') : 'main';

    const commitData = {
      repository: repo,
      branch,
      sha: headCommit?.id ? headCommit.id.substring(0, 7) : nanoid(7),
      fullSha: headCommit?.id || nanoid(40),
      author: headCommit?.author?.name || headCommit?.committer?.name || payload.pusher?.name || 'GitHub User',
      message: headCommit?.message || 'New commit change detected',
      htmlUrl: headCommit?.url || payload.repository?.html_url || '',
      date: headCommit?.timestamp || new Date().toISOString(),
    };

    const workflows = (await listAllWorkflows()).filter((wf) => {
      const nodes = wf.nodes || [];
      return nodes.some(
        (n) =>
          n.data?.configType === 'githubTrigger' ||
          n.type === 'githubTrigger' ||
          n.id === 'githubTrigger'
      );
    });

    const executionIds = [];
    for (const wf of workflows) {
      const res = await triggerCommitWorkflow(wf, commitData);
      executionIds.push(res.executionId);
    }

    return reply.code(200).send({
      success: true,
      matchedWorkflows: workflows.length,
      executionIds,
      commit: commitData,
    });
  });

  fastify.get('/api/v1/github/watcher/status', async () => {
    return {
      success: true,
      ...getWatcherStatus(),
    };
  });

  fastify.post('/api/v1/github/watcher/poll', async () => {
    const result = await pollGitHubOnce();
    return {
      success: true,
      ...result,
    };
  });

  fastify.post('/api/v1/github/watcher/simulate', async (request) => {
    const body = request.body || {};
    const result = await simulateCommitPush(body);
    return {
      success: true,
      ...result,
    };
  });
}
