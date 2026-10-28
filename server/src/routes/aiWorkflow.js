import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ChatGroq } from '@langchain/groq';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const AVAILABLE_NODES = [
  {
    configType: 'webhookTrigger',
    title: 'Webhook Trigger',
    category: 'TRIGGER',
    accent: '#d67a55',
    description: 'Receive an HTTP request to start this workflow.',
    configFields: { method: 'GET|POST|PUT|PATCH|DELETE', path: '/v1/some-path', authentication: 'none|bearer' },
  },
  {
    configType: 'githubTrigger',
    title: 'GitHub Trigger',
    category: 'TRIGGER',
    accent: '#d67a55',
    description: 'Start from repository activity like push, PR, issue events.',
    configFields: { repository: 'owner/repo (e.g. HarshChoudharyGit/FirstRepo)', events: ['issues'], branch: 'main' },
  },
  {
    configType: 'gmailTrigger',
    title: 'Gmail Trigger',
    category: 'TRIGGER',
    accent: '#d67a55',
    description: 'Start when a matching email arrives in Gmail.',
    configFields: { event: 'new_email|new_matching_email', sender: 'optional sender email' },
  },
  {
    configType: 'cronTrigger',
    title: 'Cron Trigger',
    category: 'TRIGGER',
    accent: '#d67a55',
    description: 'Start on a recurring schedule.',
    configFields: { schedule: '0 9 * * 1-5', timezone: 'UTC' },
  },
  {
    configType: 'gmail',
    title: 'Gmail',
    category: 'ACTION',
    accent: '#e87979',
    description: 'Send and manage Gmail messages.',
    configFields: { operation: 'send_email', to: 'recipient@example.com', subject: 'email subject', body: 'email body' },
  },
  {
    configType: 'aiAgent',
    title: 'AI Agent',
    category: 'AI',
    accent: '#71b89d',
    description: 'Process workflow data with an AI model. Can use tools like Gmail, GitHub, HTTP.',
    configFields: { systemInstructions: 'instructions for the AI', prompt: 'user prompt for AI', model: 'gemini-1.5-flash' },
  },
  {
    configType: 'httpRequest',
    title: 'HTTP Request',
    category: 'ACTION',
    accent: '#70a8c7',
    description: 'Call an HTTP endpoint.',
    configFields: { method: 'GET|POST|PUT|DELETE', url: 'https://api.example.com/data' },
  },
  {
    configType: 'condition',
    title: 'If / Else',
    category: 'LOGIC',
    accent: '#a78bfa',
    description: 'Evaluate a condition and route execution through TRUE or FALSE branches. Has two output handles: "true" and "false".',
    configFields: { leftValue: 'value or expression to check', operator: 'equals|notEquals|contains|greaterThan|lessThan|isEmpty', rightValue: 'comparison value' },
    isCondition: true,
  },
  {
    configType: 'javascript',
    title: 'Transform',
    category: 'CORE',
    accent: '#d4ad58',
    description: 'Transform incoming workflow data with JavaScript code.',
    configFields: { code: 'return { ...input, normalized: true };', input: '{{trigger.body}}' },
  },
  {
    configType: 'wait',
    title: 'Delay',
    category: 'CORE',
    accent: '#d4ad58',
    description: 'Pause workflow execution before continuing.',
    configFields: { duration: 5, unit: 'seconds' },
  },
  {
    configType: 'discord',
    title: 'Discord',
    category: 'ACTION',
    accent: '#7289da',
    description: 'Post a message to a Discord channel.',
    configFields: { channelId: 'discord channel ID', message: 'message text' },
  },
  {
    configType: 'slack',
    title: 'Slack',
    category: 'ACTION',
    accent: '#e87979',
    description: 'Send a message to a Slack channel.',
    configFields: { channel: '#general', message: 'message text' },
  },
];

const SYSTEM_PROMPT = `You are a workflow designer AI for the Kahn Engine automation platform. 
Given a user's description of what they want to automate, you must generate a complete workflow 
as a JSON object with nodes and edges.

## Available Node Types:
${JSON.stringify(AVAILABLE_NODES, null, 2)}

## Rules:
1. Each node needs: id (string like "node-1", "node-2", etc.), configType, title, subtitle (short description of what this specific node does), category, accent (use the color from the available nodes list above), and a configuration object with relevant fields filled in based on the user's description.
2. Edges connect nodes: { source: "node-1", target: "node-2" }. For condition nodes, edges from the condition must include sourceHandle: "true" or sourceHandle: "false".
3. A workflow MUST start with exactly ONE trigger node. The trigger is the first node.
4. Position nodes left-to-right with x increasing by ~280 per column and y spacing of ~160 for branches.
5. Fill in complete, realistic, and rich configuration values based on the user's prompt.
6. CRITICAL FOR EMAIL NODES (Gmail, etc.):
   When configuring an email action node, you MUST craft a rich, multi-line, professional email "subject" and "body" with all important details:
   - For GitHub commits / pushes:
     * Subject: e.g. "[Commit] {{trigger.payload.repository.full_name}}: {{trigger.payload.head_commit.message}}"
     * Body: Must be comprehensive with comment/message, timestamp, author name and email, commit SHA, branch, and link:
       "A new commit has been pushed to {{trigger.payload.repository.full_name}} (branch: {{trigger.payload.ref}}).\n\nCommit Details:\n- Comment: {{trigger.payload.head_commit.message}}\n- Author: {{trigger.payload.head_commit.author.name}} ({{trigger.payload.head_commit.author.email}})\n- Timestamp: {{trigger.payload.head_commit.timestamp}}\n- Commit SHA: {{trigger.payload.head_commit.id}}\n- View Commit: {{trigger.payload.head_commit.url}}"
   - For GitHub issues:
     * Subject: "[Issue #{{trigger.payload.issue.number}}] {{trigger.payload.issue.title}}"
     * Body: Include Issue Title, Author (@{{trigger.payload.issue.user.login}}), Timestamp ({{trigger.payload.issue.created_at}}), Description ({{trigger.payload.issue.body}}), and Issue URL ({{trigger.payload.issue.html_url}}).
   - For GitHub pull requests:
     * Subject: "[PR #{{trigger.payload.pull_request.number}}] {{trigger.payload.pull_request.title}}"
     * Body: Include PR Title, Author, Head/Base Branches, Timestamp, Summary, and URL.
   - For Webhooks or Cron:
     * Body: Include timestamp, payload summary, and execution details.
7. Generate a short, descriptive workflow name.
8. The workflow must be a valid Directed Acyclic Graph (DAG) — no cycles.

## Response Format:
Respond with ONLY a valid JSON object (no markdown fences, no explanation):
{
  "name": "Workflow Name",
  "nodes": [
    {
      "id": "node-1",
      "configType": "webhookTrigger",
      "title": "Webhook Trigger",
      "subtitle": "Receive incoming request",
      "category": "TRIGGER",
      "accent": "#d67a55",
      "configuration": { "method": "POST", "path": "/v1/lead" }
    }
  ],
  "edges": [
    { "source": "node-1", "target": "node-2" }
  ]
}`;

let cachedLLM = null;

function getGroqLLM() {
  if (cachedLLM) return cachedLLM;

  const apiKey = process.env.GROQ_API_KEY || process.env.CHATGROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY or CHATGROQ_API_KEY environment variable is required');
  }

  cachedLLM = new ChatGroq({
    apiKey,
    model: 'openai/gpt-oss-120b',
    temperature: 0.3,
    maxRetries: 2,
  });

  return cachedLLM;
}

function layoutNodes(nodes) {
  const X_START = 80;
  const X_GAP = 280;
  const Y_CENTER = 200;

  return nodes.map((node, index) => ({
    ...node,
    position: node.position || { x: X_START + index * X_GAP, y: Y_CENTER },
  }));
}

export async function aiWorkflowRoutes(fastify) {
  fastify.post('/api/v1/ai/generate-workflow', async (request, reply) => {
    const { prompt } = request.body || {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return reply.code(400).send({
        success: false,
        error: 'A non-empty prompt is required.',
      });
    }

    if (prompt.length > 2000) {
      return reply.code(400).send({
        success: false,
        error: 'Prompt must be under 2000 characters.',
      });
    }

    try {
      const llm = getGroqLLM();

      const aiMsg = await llm.invoke([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt.trim() },
      ]);

      let rawContent = aiMsg.content;

      // Strip markdown code fences if present
      rawContent = rawContent
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

      let workflow;
      try {
        workflow = JSON.parse(rawContent);
      } catch (parseErr) {
        fastify.log.error({ rawContent, parseErr }, 'Failed to parse LLM workflow response');
        return reply.code(422).send({
          success: false,
          error: 'The AI generated an invalid response. Please try rephrasing your prompt.',
          raw: rawContent,
        });
      }

      // Validate basic structure
      if (!workflow.nodes || !Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
        return reply.code(422).send({
          success: false,
          error: 'The AI did not generate any workflow nodes. Please try a more specific prompt.',
        });
      }

      if (!workflow.edges || !Array.isArray(workflow.edges)) {
        workflow.edges = [];
      }

      // Ensure positions
      workflow.nodes = layoutNodes(workflow.nodes);

      const promptLower = String(prompt || '').toLowerCase();
      const isCommitRelated = promptLower.includes('commit') || promptLower.includes('push');
      const isIssueRelated = promptLower.includes('issue');
      const isPRRelated = promptLower.includes('pr') || promptLower.includes('pull request');

      const normalizeConfig = (configType, config = {}) => {
        const c = { ...config };
        const type = String(configType || '').toLowerCase();

        if (type.includes('github')) {
          if (typeof c.events === 'string') c.events = c.events.split(',').map((s) => s.trim()).filter(Boolean);
          if (!Array.isArray(c.events) || c.events.length === 0) {
            c.events = isCommitRelated ? ['push'] : isIssueRelated ? ['issues'] : isPRRelated ? ['pull_request'] : ['push'];
          }
          c.branch = c.branch || 'main';
          c.repository = c.repository || 'owner/repo';
        } else if (type.includes('gmail') && !type.includes('trigger')) {
          c.operation = c.operation || (c.action ? (c.action === 'send' ? 'send_email' : c.action) : 'send_email');
          c.to = c.to || 'recipient@example.com';

          if (isCommitRelated) {
            c.subject = c.subject && c.subject !== 'Workflow Notification' && !c.subject.includes('Workflow')
              ? c.subject
              : '[GitHub Commit] {{trigger.payload.repository.full_name}}: {{trigger.payload.head_commit.message}}';

            if (!c.body || c.body === 'Automation triggered successfully.' || c.body.length < 50 || !c.body.includes('{{')) {
              c.body = `A new commit has been pushed to {{trigger.payload.repository.full_name}} (branch: {{trigger.payload.ref}}).\n\nCommit Details:\n- Comment: {{trigger.payload.head_commit.message}}\n- Author: {{trigger.payload.head_commit.author.name}} ({{trigger.payload.head_commit.author.email}})\n- Timestamp: {{trigger.payload.head_commit.timestamp}}\n- Commit SHA: {{trigger.payload.head_commit.id}}\n- View Commit: {{trigger.payload.head_commit.url}}`;
            }
          } else if (isIssueRelated) {
            c.subject = c.subject && c.subject !== 'Workflow Notification'
              ? c.subject
              : '[GitHub Issue #{{trigger.payload.issue.number}}] {{trigger.payload.issue.title}}';

            if (!c.body || c.body === 'Automation triggered successfully.' || c.body.length < 50 || !c.body.includes('{{')) {
              c.body = `A new issue was created in {{trigger.payload.repository.full_name}}.\n\nIssue Details:\n- Title: {{trigger.payload.issue.title}}\n- Author: @{{trigger.payload.issue.user.login}}\n- Timestamp: {{trigger.payload.issue.created_at}}\n- Issue URL: {{trigger.payload.issue.html_url}}\n\nDescription:\n{{trigger.payload.issue.body}}`;
            }
          } else if (isPRRelated) {
            c.subject = c.subject && c.subject !== 'Workflow Notification'
              ? c.subject
              : '[GitHub PR #{{trigger.payload.pull_request.number}}] {{trigger.payload.pull_request.title}}';

            if (!c.body || c.body === 'Automation triggered successfully.' || c.body.length < 50 || !c.body.includes('{{')) {
              c.body = `A new pull request was opened in {{trigger.payload.repository.full_name}}.\n\nPull Request Details:\n- Title: {{trigger.payload.pull_request.title}}\n- Author: @{{trigger.payload.pull_request.user.login}}\n- Branch: {{trigger.payload.pull_request.head.ref}} -> {{trigger.payload.pull_request.base.ref}}\n- Timestamp: {{trigger.payload.pull_request.created_at}}\n- PR URL: {{trigger.payload.pull_request.html_url}}\n\nSummary:\n{{trigger.payload.pull_request.body}}`;
            }
          } else {
            c.subject = c.subject || 'Workflow Notification';
            c.body = c.body || 'Automation workflow executed successfully.';
          }
        } else if (type === 'condition') {
          const opMap = {
            not_equals: 'notEquals',
            greater_than: 'greaterThan',
            less_than: 'lessThan',
            is_empty: 'isEmpty',
            not_empty: 'notEmpty',
          };
          if (opMap[c.operator]) c.operator = opMap[c.operator];
          c.operator = c.operator || 'equals';
          c.leftValue = c.leftValue || '{{trigger.payload.action}}';
          c.rightValue = c.rightValue !== undefined ? String(c.rightValue) : 'opened';
        } else if (type.includes('aiagent')) {
          c.systemInstructions = c.systemInstructions || c.systemPrompt || 'You are an AI assistant.';
          c.prompt = c.prompt || 'Process the input and provide results.';
          c.model = c.model || 'gemini-1.5-flash';
        } else if (type.includes('http')) {
          c.method = (c.method || 'GET').toUpperCase();
          c.url = c.url || 'https://api.example.com/data';
        } else if (type === 'wait' || type === 'delay') {
          c.duration = Number(c.duration) || 5;
          c.unit = c.unit || 'seconds';
        } else if (type === 'webhooktrigger' || type === 'webhook') {
          c.path = c.path || '/v1/webhook';
          c.method = (c.method || 'POST').toUpperCase();
        }
        return c;
      };

      // Build final nodes in ReactFlow format
      const finalNodes = workflow.nodes.map((node) => {
        const normalizedConfig = normalizeConfig(node.configType, node.configuration);
        return {
          id: node.id,
          type: 'workflow',
          position: node.position,
          data: {
            title: node.title,
            subtitle: node.subtitle || node.description || '',
            category: node.category || 'ACTION',
            accent: node.accent || '#d4ad58',
            configType: node.configType,
            configuration: normalizedConfig,
            configurationStatus: 'configured',
            isCondition: node.isCondition || node.configType === 'condition',
          },
        };
      });

      // Build edges
      const finalEdges = workflow.edges.map((edge, i) => ({
        id: edge.id || `e-${edge.source}-${edge.target}${edge.sourceHandle ? `-${edge.sourceHandle}` : ''}`,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || undefined,
        type: 'smoothstep',
        animated: true,
      }));

      return reply.code(200).send({
        success: true,
        workflow: {
          name: workflow.name || 'AI Generated Workflow',
          nodes: finalNodes,
          edges: finalEdges,
        },
      });
    } catch (err) {
      fastify.log.error({ err, prompt }, 'AI workflow generation failed');
      return reply.code(500).send({
        success: false,
        error: err.message || 'Failed to generate workflow. Please try again.',
      });
    }
  });
}
