import { nanoid } from 'nanoid';
import {
  createExecution,
  getWorkflow,
  listAllWorkflows,
  saveWorkflow,
} from '../db/workflowRepository.js';
import { getLatestCommit } from '../engine/agent/octokitClient.js';
import { executeWorkflow } from '../engine/executor.js';

let pollTimer = null;
let isPolling = false;
let pollIntervalMs = 10000;
let lastPolledAt = null;
const lastKnownCommits = new Map();

function getDefaultCanvasWorkflow() {
  return {
    id: 'wf_canvas_default',
    name: 'Canvas GitHub to Gmail Workflow',
    nodes: [
      {
        id: 'githubTrigger',
        type: 'workflow',
        data: {
          title: 'GitHub Trigger',
          configType: 'githubTrigger',
          configuration: {
            repository: 'HarshChoudharyGit/KahnEngine',
            branch: 'main',
            event: 'push',
          },
        },
      },
      {
        id: 'gmail',
        type: 'workflow',
        data: {
          title: 'Gmail',
          configType: 'gmail',
          configuration: {
            operation: 'send_email',
            to: '',
            subject: '',
            body: '',
          },
        },
      },
      {
        id: 'gmailTrigger',
        type: 'workflow',
        data: {
          title: 'Gmail Trigger',
          configType: 'gmailTrigger',
          configuration: {
            event: 'new_email',
            label: 'INBOX',
          },
        },
      },
    ],
    edges: [
      { source: 'githubTrigger', target: 'gmail', id: 'e-githubTrigger-gmail' },
      { source: 'gmail', target: 'gmailTrigger', id: 'e-gmail-gmailTrigger' },
    ],
  };
}

async function getWorkflowsToWatch() {
  const list = await listAllWorkflows();
  if (list && list.length > 0) {
    const matched = list.filter((wf) => {
      const nodes = wf.nodes || [];
      return nodes.some(
        (n) =>
          n.data?.configType === 'githubTrigger' ||
          n.type === 'githubTrigger' ||
          n.id === 'githubTrigger'
      );
    });
    if (matched.length > 0) return matched;
  }

  const defaultWorkflow = getDefaultCanvasWorkflow();
  if (await getWorkflow(defaultWorkflow.id)) {
    defaultWorkflow.id = `wf_${nanoid(8)}`;
  }
  await saveWorkflow(defaultWorkflow);
  return [defaultWorkflow];
}

export async function triggerCommitWorkflow(workflow, commitData) {
  const executionId = `exec_${nanoid(8)}`;
  const triggerPayload = {
    event: 'push',
    repository: commitData.repository,
    branch: commitData.branch || 'main',
    commit: commitData.sha,
    fullSha: commitData.fullSha || commitData.sha,
    author: commitData.author || 'GitHub Developer',
    message: commitData.message || 'New commit pushed to repository',
    htmlUrl: commitData.htmlUrl || '',
    timestamp: commitData.date || new Date().toISOString(),
    source: 'github-poller',
  };

  const execution = {
    id: executionId,
    workflowId: workflow.id,
    workflowName: workflow.name,
    triggerPayload,
  };
  await createExecution(execution);

  setImmediate(() => {
    void executeWorkflow(workflow, executionId, triggerPayload)
      .catch((err) => console.error('GitHub-triggered workflow execution failed', { executionId, message: err.message }));
  });

  return { executionId, workflowId: workflow.id, commit: commitData.sha };
}

export async function pollGitHubOnce() {
  if (isPolling) return { status: 'busy', lastPolledAt };
  isPolling = true;
  lastPolledAt = new Date().toISOString();
  const triggeredExecutions = [];

  try {
    const workflows = await getWorkflowsToWatch();
    for (const workflow of workflows) {
      const nodes = workflow.nodes || [];
      const githubNode = nodes.find(
        (n) =>
          n.data?.configType === 'githubTrigger' ||
          n.type === 'githubTrigger' ||
          n.id === 'githubTrigger'
      );

      if (!githubNode) continue;

      const config = githubNode.data?.configuration || githubNode.data || {};
      const repo = config.repository || 'HarshChoudharyGit/KahnEngine';
      const branch = config.branch || 'main';

      if (!repo || !repo.includes('/')) continue;

      const key = `${workflow.id}:${repo}:${branch}`;
      const latest = await getLatestCommit(repo, branch);

      if (!latest || !latest.success || !latest.sha) continue;

      if (!lastKnownCommits.has(key)) {
        lastKnownCommits.set(key, latest.sha);
        continue;
      }

      const previousSha = lastKnownCommits.get(key);
      if (previousSha !== latest.sha) {
        const result = await triggerCommitWorkflow(workflow, {
          ...latest,
          branch,
        });
        lastKnownCommits.set(key, latest.sha);
        triggeredExecutions.push(result);
      }
    }
  } finally {
    isPolling = false;
  }

  return {
    status: 'ok',
    lastPolledAt,
    triggeredCount: triggeredExecutions.length,
    triggeredExecutions,
    tracked: Array.from(lastKnownCommits.entries()).map(([key, sha]) => ({
      key,
      sha,
    })),
  };
}

export function startGitHubWatcher(intervalMs = 10000) {
  pollIntervalMs = intervalMs;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    void pollGitHubOnce().catch((err) => console.error('GitHub polling failed', { message: err.message }));
  }, pollIntervalMs);
  void pollGitHubOnce().catch((err) => console.error('GitHub polling failed', { message: err.message }));
}

export function stopGitHubWatcher() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export async function simulateCommitPush({ repository, branch = 'main', message, author, htmlUrl } = {}) {
  const workflows = await getWorkflowsToWatch();
  const results = [];
  const fakeSha = nanoid(7);
  const targetRepo = repository || 'HarshChoudharyGit/KahnEngine';
  const commitData = {
    repository: targetRepo,
    branch,
    sha: fakeSha,
    fullSha: `${fakeSha}${nanoid(33)}`,
    author: author || 'Harsh Choudhary',
    message: message || 'Automated commit dispatch test',
    htmlUrl: htmlUrl || `https://github.com/${targetRepo}/commit/${fakeSha}`,
    date: new Date().toISOString(),
  };

  for (const workflow of workflows) {
    const res = await triggerCommitWorkflow(workflow, commitData);
    results.push(res);
  }

  return { success: true, count: results.length, executions: results, commit: commitData };
}

export function getWatcherStatus() {
  return {
    running: Boolean(pollTimer),
    intervalMs: pollIntervalMs,
    lastPolledAt,
    tracked: Array.from(lastKnownCommits.entries()).map(([key, sha]) => ({
      key,
      sha,
    })),
  };
}
