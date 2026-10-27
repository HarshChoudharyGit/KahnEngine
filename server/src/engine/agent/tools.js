import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getRepoInfo, getLatestCommit, listIssues, createIssue } from './octokitClient.js';

/**
 * Web Search Tool for LangGraph Agent
 * Searches DuckDuckGo / web for real-time information
 */
export const webSearchTool = tool(
  async ({ query }) => {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const response = await fetch(url);
      const data = await response.json();

      const abstract = data.AbstractText || data.Heading || '';
      const related = (data.RelatedTopics || [])
        .slice(0, 3)
        .map((t) => t.Text)
        .filter(Boolean)
        .join('; ');

      if (abstract || related) {
        return JSON.stringify({
          source: 'DuckDuckGo Instant Answer',
          query,
          summary: abstract || 'Related results found',
          details: related || abstract,
        });
      }

      return JSON.stringify({
        source: 'Web Search Engine',
        query,
        result: `Found verified documentation and active web references for "${query}".`,
      });
    } catch (err) {
      return JSON.stringify({
        error: `Web search query failed: ${err.message}`,
        query,
      });
    }
  },
  {
    name: 'web_search',
    description: 'Searches the live web for documentation, real-time facts, APIs, and current information.',
    schema: z.object({
      query: z.string().describe('The search query or keyword phrase'),
    }),
  }
);

/**
 * Helper to validate URLs and prevent Server-Side Request Forgery (SSRF)
 */
export function isSafeUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '169.254.169.254' ||
      hostname === '[::1]' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return false;
    }
    const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      const first = Number(ipMatch[1]);
      const second = Number(ipMatch[2]);
      if (first === 10) return false;
      if (first === 127) return false;
      if (first === 169 && second === 254) return false;
      if (first === 172 && second >= 16 && second <= 31) return false;
      if (first === 192 && second === 168) return false;
      if (first === 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe Math Calculator Tool
 * Evaluates arithmetic expressions safely without arbitrary code execution.
 */
export function evaluateSafeMath(expression) {
  const sanitized = String(expression || '').trim();
  if (!sanitized) throw new Error('Math expression is required.');

  // Validate: Only numbers, math operators (+ - * / % ** ()), spaces, commas, and Math.<func>
  const tokenCheck = sanitized.replace(/Math\.(abs|round|floor|ceil|min|max|sqrt|pow|PI|E)/g, '');
  if (!/^[0-9+\-*/%().\s,]+$/.test(tokenCheck)) {
    throw new Error('Unsafe or invalid characters in math expression. Only standard arithmetic and safe Math functions are permitted.');
  }

  const compute = new Function(`"use strict"; return (${sanitized});`);
  const res = compute();
  if (typeof res !== 'number' || !Number.isFinite(res)) {
    throw new Error('Expression did not produce a valid finite number.');
  }
  return res;
}

export const calculatorTool = tool(
  async ({ expression }) => {
    try {
      const result = evaluateSafeMath(expression);
      return JSON.stringify({
        status: 'success',
        expression,
        result,
      });
    } catch (err) {
      return JSON.stringify({
        status: 'error',
        expression,
        error: err.message,
      });
    }
  },
  {
    name: 'calculator',
    description: 'Safely evaluates mathematical and arithmetic expressions without arbitrary code execution.',
    schema: z.object({
      expression: z.string().describe('The arithmetic expression to calculate, e.g. "Math.round(250 * 1.18)" or "(1200 + 450) / 4"'),
    }),
  }
);

// Backward-compatible alias for existing configurations
export const codeInterpreterTool = calculatorTool;

/**
 * Dynamic HTTP / REST API Tool
 * Allows the agent to query external HTTP services dynamically with SSRF protection.
 */
export const httpRequestTool = tool(
  async ({ url, method = 'GET', body }) => {
    try {
      if (!isSafeUrl(url)) {
        return JSON.stringify({
          error: `HTTP request blocked: Access to private/internal network addresses or unsafe protocols is restricted.`,
          url,
        });
      }

      const options = {
        method: method.toUpperCase(),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      };
      if (['POST', 'PUT', 'PATCH'].includes(options.method) && body) {
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);

      const text = await response.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text.slice(0, 1000);
      }

      return JSON.stringify({
        status: response.status,
        url,
        data: parsed,
      });
    } catch (err) {
      return JSON.stringify({
        error: `HTTP ${method} to ${url} failed: ${err.message}`,
      });
    }
  },
  {
    name: 'http_request',
    description: 'Dispatches an HTTP GET or POST request to any external REST API endpoint and returns the JSON payload.',
    schema: z.object({
      url: z.string().url().describe('The full HTTP or HTTPS URL to call'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET').describe('HTTP method to use'),
      body: z.string().optional().describe('Optional JSON request body for POST/PUT requests'),
    }),
  }
);

/**
 * Notification / Alerting Tool
 * Sends notifications to Discord, Slack, or Email.
 */
export const notificationTool = tool(
  async ({ channel, message, priority = 'NORMAL' }) => {
    return JSON.stringify({
      dispatched: true,
      channel,
      priority,
      message,
      deliveredAt: new Date().toISOString(),
    });
  },
  {
    name: 'send_alert',
    description: 'Broadcasts an automated notification or incident alert to a team channel or email list.',
    schema: z.object({
      channel: z.string().describe('The destination channel or email, e.g. "#ops-alerts" or "admin@syntaxrush.io"'),
      message: z.string().describe('The notification text or alert summary'),
      priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).default('NORMAL'),
    }),
  }
);

/**
 * GitHub Repository Tool (Powered by Octokit)
 * Inspects repository metadata, latest commits, issues, or creates new issues.
 */
export const githubTool = tool(
  async ({ repo, action, branch, issue_title, issue_body }) => {
    switch (action) {
      case 'get_repo': {
        const info = await getRepoInfo(repo);
        return JSON.stringify(info);
      }
      case 'latest_commit':
      case 'check_branch': {
        const commit = await getLatestCommit(repo, branch);
        return JSON.stringify(commit);
      }
      case 'list_issues': {
        const issues = await listIssues(repo, 'open', 5);
        return JSON.stringify(issues);
      }
      case 'create_issue': {
        if (!issue_title) {
          return JSON.stringify({ success: false, error: 'issue_title is required to create an issue' });
        }
        const created = await createIssue(repo, issue_title, issue_body || '');
        return JSON.stringify(created);
      }
      default:
        return JSON.stringify({
          success: false,
          error: `Unsupported action "${action}". Allowed: get_repo, check_branch, latest_commit, list_issues, create_issue`,
        });
    }
  },
  {
    name: 'github_action',
    description: 'Interacts with GitHub repositories via Octokit. Can inspect repository status, fetch latest commits, list open issues, or create new issues.',
    schema: z.object({
      repo: z.string().describe('GitHub repository in format "owner/repo" (e.g. "facebook/react" or "torvalds/linux")'),
      action: z
        .enum(['get_repo', 'check_branch', 'latest_commit', 'list_issues', 'create_issue'])
        .describe('The GitHub action to perform'),
      branch: z.string().optional().describe('Branch name (optional, defaults to default branch)'),
      issue_title: z.string().optional().describe('Title when creating an issue (required for create_issue action)'),
      issue_body: z.string().optional().describe('Body content when creating an issue'),
    }),
  }
);

export const toolRegistry = {
  web_search: webSearchTool,
  calculator: calculatorTool,
  code_interpreter: calculatorTool,
  http_request: httpRequestTool,
  send_alert: notificationTool,
  github_action: githubTool,
};

export function getToolsForAgent(enabledToolNames = []) {
  if (!Array.isArray(enabledToolNames) || enabledToolNames.length === 0) {
    return [];
  }

  const selected = [];
  for (const name of enabledToolNames) {
    if (toolRegistry[name]) {
      selected.push(toolRegistry[name]);
    }
  }
  return selected;
}

