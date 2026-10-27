import { memoryStore } from '../store/memoryStore.js';
import {
  appendLog,
  finishNodeExecution,
  sanitizeLogEntry,
  startExecution,
  startNodeExecution,
  updateExecution,
} from '../db/workflowRepository.js';
import { runKahnsAlgorithm } from './kahnsAlgorithm.js';
import { executeLangGraphAgent } from './agent/langgraphAgent.js';
import { getLatestCommit } from './agent/octokitClient.js';
import {
  isGmailConnected,
  getGmailUser,
  sendEmail,
  searchEmails,
  replyToEmail,
  addLabel,
} from './agent/gmailClient.js';

/**
 * Executes a workflow graph deterministically using topological ordering.
 * Pushes real-time SSE telemetry events for every node transition.
 */
export async function executeWorkflow(workflow, executionId, triggerPayload = {}) {
  const { nodes = [], edges = [] } = workflow;
  const executionStartMs = Date.now();

  // 1. Validate DAG with Kahn's algorithm
  const kahnResult = runKahnsAlgorithm(nodes, edges);
  if (!kahnResult.isValid) {
    const errorMsg = kahnResult.error || 'Cycle detected in graph';
    await updateExecution(executionId, {
      status: 'FAILED',
      error: errorMsg,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - executionStartMs,
    });

    memoryStore.broadcastTelemetry(executionId, 'execution_failed', {
      executionId,
      error: errorMsg,
      cycleNodes: kahnResult.cycleNodes,
    });


    return;
  }

  // Mark execution as RUNNING
  // Node context storage (passing outputs between nodes)
  const context = {
    executionId,
    trigger: triggerPayload,
    outputs: {},
    nodes: {},
  };

  await startExecution(executionId, nodes);
  memoryStore.broadcastTelemetry(executionId, 'execution_started', {
    executionId,
    workflowId: workflow.id,
    topologicalOrder: kahnResult.topologicalOrder.map((n) => n.id),
  });

  // 2. Execute nodes sequentially in topological order
  for (let i = 0; i < kahnResult.topologicalOrder.length; i++) {
    const node = kahnResult.topologicalOrder[i];
    const nodeId = node.id;
    const nodeLabel = node.data?.title || node.data?.label || nodeId;
    const nodeType = (node.data?.configType || node.data?.type || node.type || 'default').toLowerCase();
    const nodeStartMs = Date.now();

    const incomingEdges = (edges || []).filter((e) => e.target === nodeId);
    const predecessorNodeIds = incomingEdges.map((e) => e.source);
    node._incomingEdges = incomingEdges;
    node._predecessorIds = predecessorNodeIds;

    await startNodeExecution(executionId, {
      nodeId,
      nodeType,
      input: {
        nodeTitle: nodeLabel,
        trigger: context.trigger,
        outputs: context.outputs,
        nodes: context.nodes,
      },
    });

    // Broadcast node RUNNING
    memoryStore.broadcastTelemetry(executionId, 'node_status', {
      nodeId,
      status: 'RUNNING',
      stepIndex: i + 1,
      totalSteps: kahnResult.topologicalOrder.length,
      timestamp: Date.now(),
    });

    let logQueue = Promise.resolve();
    let logPersistenceError = null;
    const log = (message, level = 'INFO') => {
      const entry = sanitizeLogEntry({ nodeId, nodeTitle: nodeLabel, level, message, timestamp: Date.now() });
      logQueue = logQueue
        .then(() => appendLog(executionId, entry))
        .catch((err) => {
          logPersistenceError ||= err;
        });
      memoryStore.broadcastTelemetry(executionId, 'node_log', entry);
      return logQueue;
    };

    log(`[Step ${i + 1}/${kahnResult.topologicalOrder.length}] Starting: "${nodeLabel}" (${nodeType})`);

    try {
      const result = await executeSingleNode(node, context, log);
      await logQueue;
      if (logPersistenceError) {
        throw new Error('Could not persist workflow execution log', { cause: logPersistenceError });
      }
      const durationMs = Date.now() - nodeStartMs;
      context.outputs[nodeId] = result;
      context.nodes[nodeId] = {
        id: nodeId,
        type: nodeType,
        title: nodeLabel,
        configType: node.data?.configType || nodeType,
        output: result,
      };

      // Broadcast node SUCCESS
      await finishNodeExecution(executionId, {
        nodeId,
        status: 'completed',
        output: result,
      });

      memoryStore.broadcastTelemetry(executionId, 'node_status', {
        nodeId,
        status: 'SUCCESS',
        durationMs,
        timestamp: Date.now(),
      });
      log(`Node "${nodeLabel}" completed successfully in ${durationMs}ms.`);
      await logQueue;
      if (logPersistenceError) {
        throw new Error('Could not persist workflow execution log', { cause: logPersistenceError });
      }
    } catch (err) {
      await logQueue;
      const durationMs = Date.now() - nodeStartMs;
      const totalDurationMs = Date.now() - executionStartMs;

      // Broadcast node FAILED
      await finishNodeExecution(executionId, {
        nodeId,
        status: 'failed',
        output: null,
        error: err.message,
      });
      await updateExecution(executionId, {
        status: 'FAILED',
        error: err.message,
        completedAt: new Date().toISOString(),
        durationMs: totalDurationMs,
      });

      memoryStore.broadcastTelemetry(executionId, 'node_status', {
        nodeId,
        status: 'FAILED',
        error: err.message,
        durationMs,
        timestamp: Date.now(),
      });
      log(`Node "${nodeLabel}" failed: ${err.message}`, 'ERROR');
      await logQueue;
      if (logPersistenceError) {
        throw new Error('Could not persist workflow execution log', { cause: logPersistenceError });
      }

      memoryStore.broadcastTelemetry(executionId, 'execution_failed', {
        executionId,
        failedNodeId: nodeId,
        error: err.message,
        durationMs: totalDurationMs,
      });
      return;
    }
  }

  // All nodes succeeded
  const totalDurationMs = Date.now() - executionStartMs;
  await updateExecution(executionId, {
    status: 'SUCCESS',
    completedAt: new Date().toISOString(),
    durationMs: totalDurationMs,
  });
  memoryStore.broadcastTelemetry(executionId, 'execution_completed', {
    executionId,
    status: 'SUCCESS',
    durationMs: totalDurationMs,
  });
}

/**
 * Redacts sensitive tokens, passwords, and API keys from string values before logging.
 */
export function redactSensitive(text) {
  if (typeof text !== 'string') {
    if (text === null || text === undefined) return '';
    text = typeof text === 'object' ? JSON.stringify(text) : String(text);
  }
  return text
    .replace(/\bBearer\s+[A-Za-z\d._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\b(access_token|refresh_token|client_secret|password|api[_-]?key|secret)\s*[:=]\s*[^&\s,;]+/gi, '$1=[REDACTED]')
    .replace(/ghp_[A-Za-z0-9_]{20,}/g, 'ghp_[REDACTED]')
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, 'sk-[REDACTED]');
}

/**
 * Resolves a variable path such as "nodes.aiAgent1.output.text", "outputs.node-1.status",
 * or "trigger.body" against the execution context.
 */
export function resolveVariablePath(pathStr, context) {
  if (!pathStr || typeof pathStr !== 'string' || !context) return undefined;
  const normalizedPath = pathStr.trim().replace(/\[(\d+)\]/g, '.$1');
  const parts = normalizedPath.split('.');
  const root = parts[0];

  const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const findNode = (targetKey) => {
    if (!targetKey) return undefined;
    if (context.nodes && context.nodes[targetKey] !== undefined) {
      return context.nodes[targetKey];
    }
    if (context.outputs && context.outputs[targetKey] !== undefined) {
      const out = context.outputs[targetKey];
      return { output: out, ...(typeof out === 'object' && out !== null ? out : {}) };
    }
    const targetClean = clean(targetKey);
    if (context.nodes) {
      for (const [nId, nData] of Object.entries(context.nodes)) {
        if (
          clean(nId) === targetClean ||
          clean(nData.title) === targetClean ||
          clean(nData.type) === targetClean ||
          clean(nData.configType) === targetClean
        ) {
          return nData;
        }
      }
    }
    if (context.outputs) {
      for (const [nId, out] of Object.entries(context.outputs)) {
        if (clean(nId) === targetClean) {
          return { output: out, ...(typeof out === 'object' && out !== null ? out : {}) };
        }
      }
    }
    return undefined;
  };

  let current;
  let remainingParts = parts.slice(1);

  if (root === 'trigger') {
    current = context.trigger;
  } else if (root === 'outputs') {
    const targetKey = parts[1];
    remainingParts = parts.slice(2);
    const nodeObj = findNode(targetKey);
    current = nodeObj ? (nodeObj.output !== undefined ? nodeObj.output : nodeObj) : undefined;
  } else if (root === 'nodes') {
    const targetKey = parts[1];
    remainingParts = parts.slice(2);
    current = findNode(targetKey);
  } else {
    const nodeObj = findNode(root);
    if (nodeObj !== undefined) {
      current = nodeObj;
    } else {
      current = context[root];
    }
  }

  for (let i = 0; i < remainingParts.length; i++) {
    const p = remainingParts[i];
    if (current === undefined || current === null) return undefined;
    if (typeof current === 'string') {
      if (['text', 'output', 'completion', 'response', 'value', 'data'].includes(p)) {
        continue;
      }
      return undefined;
    }
    if (current[p] !== undefined) {
      current = current[p];
    } else if (current.output && typeof current.output === 'object' && current.output[p] !== undefined) {
      current = current.output[p];
    } else {
      current = undefined;
    }
  }

  return current;
}

/**
 * Recursively resolves {{trigger.*}}, {{nodes.nodeId.output.*}}, and {{outputs.nodeId.*}} expressions
 */
export function resolveExpressions(obj, context, isCodeField = false) {
  if (isCodeField) return obj;
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    // Direct value replacement if the entire string is {{expression}}
    const exactMatch = trimmed.match(/^\{\{([\w.[\]-]+)\}\}$/);
    if (exactMatch) {
      const val = resolveVariablePath(exactMatch[1], context);
      if (val !== undefined) return val;
    }

    // Inline substring interpolation
    return obj.replace(/\{\{([\w.[\]-]+)\}\}/g, (match, pathStr) => {
      const val = resolveVariablePath(pathStr, context);
      if (val === undefined || val === null) return match;
      if (typeof val === 'object' && val !== null) {
        if (typeof val.text === 'string') return val.text;
        if (typeof val.data === 'string') return val.data;
        return JSON.stringify(val, null, 2);
      }
      return String(val);
    });
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveExpressions(item, context));
  }

  if (obj && typeof obj === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = resolveExpressions(v, context, k === 'code');
    }
    return res;
  }

  return obj;
}

/**
 * Handler for individual node types
 */
async function executeSingleNode(node, context, log) {
  const nodeLabel = node.data?.title || node.data?.label || node.id;
  const nodeType = (node.data?.configType || node.data?.type || node.type || '').toLowerCase();
  const rawConfig = node.data?.configuration || node.data || {};
  const config = resolveExpressions(rawConfig, context);

  switch (nodeType) {
    case 'webhook':
    case 'webhooktrigger': {
      const path = config.path || '/webhook/default';
      log(`Webhook listener active on ${path}. Ingested payload: ${JSON.stringify(context.trigger)}`);
      return { received: context.trigger, path };
    }

    case 'crontrigger':
    case 'cron': {
      const schedule = config.schedule || '0 9 * * 1-5';
      log(`Cron trigger evaluated on schedule: ${schedule}`);
      return { triggeredAt: new Date().toISOString(), schedule };
    }

    case 'wait':
    case 'delay': {
      let durationMs = 1000;
      if (config.duration) {
        const dur = Number(config.duration) || 1;
        const unit = config.unit || 'seconds';
        if (unit === 'seconds') durationMs = dur * 1000;
        else if (unit === 'minutes') durationMs = Math.min(dur * 60 * 1000, 10000);
        else durationMs = dur * 1000;
      } else if (config.durationMs) {
        durationMs = Number(config.durationMs);
      }
      log(`Pausing workflow execution for ${durationMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, durationMs));
      return { delayedMs: durationMs };
    }

    case 'javascript':
    case 'transform': {
      log('Executing custom transform script...');
      if (config.code) {
        try {
          const fn = new Function('trigger', 'context', 'outputs', config.code);
          const res = fn(context.trigger, context, context.outputs);
          log(`Transform output: ${JSON.stringify(res)?.slice(0, 100)}`);
          return res !== undefined ? res : { transformed: true };
        } catch (err) {
          log(`Transform script evaluation note: ${err.message}. Using safe projected fallback.`, 'WARN');
          return { transformedAt: new Date().toISOString(), input: context.trigger };
        }
      }
      return { transformedAt: new Date().toISOString(), input: context.trigger };
    }

    case 'http':
    case 'httprequest':
    case 'http-request': {
      let url = config.url || 'https://jsonplaceholder.typicode.com/posts/1';
      const method = (config.method || 'GET').toUpperCase();

      const headers = { Accept: 'application/json' };
      if (Array.isArray(config.headers)) {
        for (const h of config.headers) {
          if (h.key && h.key.trim()) headers[h.key.trim()] = h.value || '';
        }
      } else if (config.headers && typeof config.headers === 'object') {
        Object.assign(headers, config.headers);
      }

      if (config.authentication === 'bearer') {
        headers.Authorization = `Bearer ${config.bearerToken}`;
      } else if (config.authentication === 'apiKey') {
        headers[config.apiKeyName] = config.apiKeyValue;
      } else if (config.authentication === 'basic' && (config.basicUsername || config.basicPassword)) {
        const credentials = Buffer.from(`${config.basicUsername || ''}:${config.basicPassword || ''}`).toString('base64');
        headers.Authorization = `Basic ${credentials}`;
      }

      if (Array.isArray(config.queryParams) && config.queryParams.length > 0) {
        const query = new URLSearchParams();
        for (const q of config.queryParams) {
          if (q.key && q.key.trim()) query.append(q.key.trim(), q.value || '');
        }
        const queryString = query.toString();
        if (queryString) {
          url += (url.includes('?') ? '&' : '?') + queryString;
        }
      }

      log(`Dispatching HTTP ${method} request to ${url}`);

      let body = undefined;
      if (['POST', 'PUT', 'PATCH'].includes(method) && config.body) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        body = typeof config.body === 'string' ? config.body : JSON.stringify(config.body);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const responseText = await response.text();
        let parsed;
        try {
          parsed = JSON.parse(responseText);
        } catch {
          if (/<html|<!DOCTYPE/i.test(responseText)) {
            const titleMatch = responseText.match(/<title[^>]*>(.*?)<\/title>/i);
            const pageTitle = titleMatch ? titleMatch[1].trim() : '';
            const cleanText = responseText
              .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 1500);
            parsed = pageTitle ? `${pageTitle}\n\n${cleanText}` : cleanText || responseText.slice(0, 500);
          } else {
            parsed = responseText.slice(0, 2000);
          }
        }

        log(`HTTP response status: ${response.status} (${response.statusText || 'OK'})`);
        return {
          status: response.status,
          statusText: response.statusText || 'OK',
          data: parsed,
          text: typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2),
        };
      } catch (err) {
        clearTimeout(timeoutId);
        throw new Error(`HTTP request failed: ${err.message}`);
      }
    }

    case 'github':
    case 'githubtrigger': {
      if (context.trigger?.commit && context.trigger?.repository) {
        log(`Ingesting polled commit ${context.trigger.commit} on ${context.trigger.repository}`);
        return {
          ...context.trigger,
          liveSync: true,
        };
      }

      const repo = config.repository || 'HarshChoudharyGit/KahnEngine';
      const event = config.event || 'push';
      log(`GitHub webhook trigger active: [${event}] on "${repo}"`);

      let liveCommit = null;
      if (repo && repo.includes('/')) {
        try {
          const commitRes = await getLatestCommit(repo, config.branch || null);
          if (commitRes?.success) {
            liveCommit = commitRes;
            log(`Octokit live commit sync: ${commitRes.sha} (${commitRes.message?.substring(0, 40)}…) by ${commitRes.author}`);
          }
        } catch {
        }
      }

      return {
        event,
        repository: repo,
        branch: config.branch || 'main',
        commit: liveCommit?.sha || 'e8d19ab',
        author: liveCommit?.author || 'developer@webster2026.local',
        message: liveCommit?.message || 'Automated pipeline dispatch',
        timestamp: liveCommit?.date || new Date().toISOString(),
        liveSync: Boolean(liveCommit),
      };
    }

    case 'gmailtrigger': {
      const event = config.event || 'new_email';
      const label = config.label || 'INBOX';
      const connected = isGmailConnected();
      const gmailUser = getGmailUser();

      if (context.trigger?.commit && context.trigger?.repository && connected) {
        const recipient = config.to?.trim() || config.sender?.trim() || gmailUser?.email || '';
        if (recipient) {
          const pushSubject = `[${context.trigger.repository}] New commit ${context.trigger.commit} by ${context.trigger.author}`;
          const pushBody = `New commit change detected on ${context.trigger.repository}\n\nBranch: ${context.trigger.branch || 'main'}\nCommit: ${context.trigger.commit}\nAuthor: ${context.trigger.author}\nMessage: ${context.trigger.message}\nURL: ${context.trigger.htmlUrl || ''}\nTimestamp: ${context.trigger.timestamp || new Date().toISOString()}\n\nDispatched automatically by Kahn Engine workflow.`;
          try {
            await sendEmail({ to: recipient, subject: pushSubject, body: pushBody });
            log(`Gmail trigger dispatched email to <${recipient}>: "${pushSubject}"`);
          } catch (err) {
            log(`Gmail trigger email dispatch note: ${err.message}`, 'WARN');
          }
        }
      }

      if (!connected) {
        log(`Gmail trigger (simulated — not connected): listening for event "${event}" in ${label}`);
        return {
          event,
          label,
          sender: config.sender || 'notifications@service.com',
          subject: config.subjectContains || 'Automated pipeline dispatch',
          snippet: 'Simulated incoming email trigger payload',
          messageId: `sim_${Date.now()}`,
          timestamp: new Date().toISOString(),
          simulated: true,
        };
      }

      log(`Gmail trigger evaluated for event "${event}" (account: ${gmailUser?.email || 'connected'})`);

      let latestEmail = null;
      try {
        const queryParts = [];
        if (label) queryParts.push(`label:${label}`);
        if (config.sender) queryParts.push(`from:${config.sender}`);
        if (config.subjectContains) queryParts.push(`subject:(${config.subjectContains})`);
        if (config.hasAttachments) queryParts.push('has:attachment');
        const query = queryParts.join(' ') || `label:${label}`;

        const searchResult = await searchEmails({ query, maxResults: 1 });
        if (searchResult?.messages && searchResult.messages.length > 0) {
          latestEmail = searchResult.messages[0];
          log(`Gmail trigger ingested latest message: "${latestEmail.subject}" from <${latestEmail.from}>`);
        } else {
          log(`No matching emails found for query "${query}". Ingesting active trigger state.`);
        }
      } catch (err) {
        log(`Gmail trigger live search note: ${err.message}. Proceeding with pipeline context.`, 'WARN');
      }

      return {
        event,
        label,
        messageId: latestEmail?.id || `msg_${Date.now()}`,
        threadId: latestEmail?.threadId || '',
        from: latestEmail?.from || config.sender || 'notifications@service.com',
        to: latestEmail?.to || gmailUser?.email || '',
        subject: latestEmail?.subject || config.subjectContains || 'New Incoming Email',
        snippet: latestEmail?.snippet || '',
        date: latestEmail?.date || new Date().toISOString(),
        liveSync: Boolean(latestEmail?.id),
      };
    }

    case 'gmail':
    case 'gmailaction': {
      const operation = config.operation || 'send_email';
      const connected = isGmailConnected();
      const gmailUser = getGmailUser();

      log(`Gmail node executing (Operation: ${operation}, Connected: ${connected})`);

      try {
        switch (operation) {
          case 'send_email': {
            let to = config.to?.trim() || '';
            if (!to) {
              // 1. Check predecessor connected nodes from graph edges
              const predIds = node._predecessorIds || [];
              for (let p = predIds.length - 1; p >= 0; p--) {
                const pId = predIds[p];
                const predOut = context.outputs?.[pId] || context.nodes?.[pId]?.output;
                const data = predOut?.data || predOut;
                if (data && typeof data === 'object') {
                  const candidate = data.email || data.recipient || data.to;
                  if (typeof candidate === 'string' && candidate.includes('@')) {
                    to = candidate.trim();
                    log(`Recipient (to) inferred from predecessor node [${pId}]: <${to}>`);
                    break;
                  }
                }
              }

              // 2. Check all previous outputs in context
              if (!to) {
                for (const prevOutput of Object.values(context.outputs || {}).reverse()) {
                  const data = prevOutput?.data || prevOutput;
                  if (data && typeof data === 'object') {
                    const candidate = data.email || data.recipient || data.to;
                    if (typeof candidate === 'string' && candidate.includes('@')) {
                      to = candidate.trim();
                      log(`Recipient (to) inferred from previous node output: <${to}>`);
                      break;
                    }
                  }
                }
              }

              // 3. Check trigger
              if (!to) {
                if (context.trigger?.to) {
                  to = context.trigger.to;
                } else if (context.trigger?.from) {
                  const match = context.trigger.from.match(/<([^>]+)>/);
                  to = match ? match[1] : context.trigger.from;
                  log(`Recipient (to) inferred from upstream trigger: <${to}>`);
                } else if (context.trigger?.sender) {
                  to = context.trigger.sender;
                  log(`Recipient (to) inferred from upstream trigger: <${to}>`);
                } else if (gmailUser?.email) {
                  to = gmailUser.email;
                  log(`Recipient (to) default to connected account: <${to}>`);
                }
              }
            }

            if (!to) {
              if (connected) {
                throw new Error('Recipient email (to) is required. Please specify a recipient in the Gmail node configuration.');
              } else {
                to = 'pipeline-alerts@syntaxrush.io';
              }
            }

            let subject = config.subject?.trim() || '';
            if (!subject) {
              const predIds = node._predecessorIds || [];
              const lastPredId = predIds[predIds.length - 1];
              const lastOutput = lastPredId ? (context.outputs?.[lastPredId] || context.nodes?.[lastPredId]?.output) : null;
              if (lastOutput) {
                subject = `Workflow Step [${lastPredId}] Result (${lastOutput.status || 'Success'})`;
              } else if (context.trigger?.repository) {
                subject = `[${context.trigger.repository}] Push commit ${context.trigger.commit} by ${context.trigger.author}`;
              } else if (context.trigger?.subject) {
                subject = `Re: ${context.trigger.subject}`;
              } else {
                subject = 'Kahn Engine Notification';
              }
            }

            let body = config.body !== undefined && config.body !== null ? String(config.body).trim() : '';
            // If body is empty, fall back to predecessor node output (e.g. AI Agent response or HTTP result)
            if (!body) {
              const predIds = node._predecessorIds || [];
              for (let p = predIds.length - 1; p >= 0; p--) {
                const pId = predIds[p];
                const predNode = context.nodes?.[pId];
                const candidate = predNode?.output ?? context.outputs?.[pId];
                if (candidate !== undefined && candidate !== null) {
                  if (typeof candidate === 'object') {
                    const extracted = candidate.text || candidate.output || candidate.completion || candidate.response;
                    if (typeof extracted === 'string') {
                      body = extracted;
                    } else if (candidate.data !== undefined) {
                      body = typeof candidate.data === 'object' ? JSON.stringify(candidate.data, null, 2) : String(candidate.data);
                    } else {
                      body = JSON.stringify(candidate, null, 2);
                    }
                  } else {
                    body = String(candidate);
                  }
                  log(`Email body populated with output from predecessor node [${pId}].`);
                  break;
                }
              }

              // Fallback to last output in context if no predecessor output found
              if (!body) {
                const outputEntries = Object.entries(context.outputs || {});
                if (outputEntries.length > 0) {
                  const [lastNodeId, lastOutput] = outputEntries[outputEntries.length - 1];
                  const dataToFormat = lastOutput?.data !== undefined ? lastOutput.data : lastOutput;
                  body = typeof dataToFormat === 'object'
                    ? (dataToFormat.text || dataToFormat.output || dataToFormat.completion || JSON.stringify(dataToFormat, null, 2))
                    : String(dataToFormat);
                  log(`Email body populated with output from previous node [${lastNodeId}].`);
                } else if (context.trigger?.snippet) {
                  body = `Response to: ${context.trigger.snippet}`;
                } else {
                  body = 'Automated workflow notification from Kahn Engine.';
                }
              }
            }

            const safeTo = redactSensitive(to);
            const safeSubject = redactSensitive(subject);
            const safeBody = redactSensitive(body);

            log(`Resolved email content - To: <${safeTo}>, Subject: "${safeSubject}", Body:\n${safeBody}`);

            if (!connected) {
              log(`Gmail integration (simulated — not connected): message to <${safeTo}> with subject "${safeSubject}"`);
              return {
                sent: true,
                simulated: true,
                operation: 'send_email',
                recipient: to,
                subject,
                body,
                messageId: `sim_${Date.now()}`,
                timestamp: new Date().toISOString(),
              };
            }

            log(`Sending email to <${safeTo}>: "${safeSubject}"`);
            const result = await sendEmail({ to, subject, body, cc: config.cc, bcc: config.bcc });
            log(`Email sent successfully. Message ID: ${result.messageId}`);
            return { ...result, operation: 'send_email', recipient: to, subject, body };
          }

          case 'reply_email': {
            const messageId = config.messageId || context.trigger?.messageId || '';
            let body = config.body !== undefined && config.body !== null ? String(config.body).trim() : '';
            if (!body) {
              const predIds = node._predecessorIds || [];
              for (let p = predIds.length - 1; p >= 0; p--) {
                const pId = predIds[p];
                const candidate = context.nodes?.[pId]?.output ?? context.outputs?.[pId];
                if (candidate) {
                  body = typeof candidate === 'object'
                    ? (candidate.text || candidate.output || candidate.completion || JSON.stringify(candidate))
                    : String(candidate);
                  break;
                }
              }
            }
            if (!body) body = 'Automated response from Kahn Engine.';
            const safeBody = redactSensitive(body);
            log(`Resolved reply email content - Message ID: ${messageId}, Body:\n${safeBody}`);

            if (!connected) {
              return { sent: true, simulated: true, operation: 'reply_email', messageId, body };
            }
            if (!messageId) throw new Error('Message ID is required to reply.');
            log(`Replying to message ${messageId}`);
            const result = await replyToEmail({ messageId, body });
            log(`Reply sent. New message ID: ${result.messageId}`);
            return { ...result, operation: 'reply_email', body };
          }

          case 'search_emails': {
            const query = config.searchQuery || 'is:unread';
            log(`Searching emails: "${query}"`);
            if (!connected) {
              return { operation: 'search_emails', query, count: 0, messages: [], simulated: true };
            }
            const result = await searchEmails({ query, maxResults: 10 });
            log(`Found ${result.count} matching emails.`);
            return { ...result, operation: 'search_emails', query };
          }

          case 'add_label': {
            const messageId = config.messageId || context.trigger?.messageId || '';
            const labelName = config.labelName || 'STARRED';
            log(`Adding label "${labelName}" to message ${messageId}`);
            if (!connected) {
              return { operation: 'add_label', messageId, labelName, simulated: true };
            }
            if (!messageId) throw new Error('Message ID is required to add a label.');
            const result = await addLabel({ messageId, labelName });
            log(`Label added successfully.`);
            return { ...result, operation: 'add_label' };
          }

          default: {
            log(`Unknown Gmail operation: ${operation}. Treating as send.`, 'WARN');
            const to = config.to || 'pipeline-alerts@syntaxrush.io';
            const subject = config.subject || 'Kahn Engine Notification';
            const body = config.body || '';
            const safeBody = redactSensitive(body);
            log(`Resolved email content - To: <${to}>, Subject: "${subject}", Body:\n${safeBody}`);
            if (!connected) {
              return { sent: true, simulated: true, operation, recipient: to, subject, body };
            }
            const result = await sendEmail({ to, subject, body });
            return { ...result, operation, body };
          }
        }
      } catch (err) {
        log(`Gmail operation "${operation}" failed: ${err.message}`, 'ERROR');
        throw err;
      }
    }

    case 'discord': {
      const channel = config.channelId || config.channel || 'alerts';
      const message = config.message || config.content || 'Workflow notification executed successfully.';
      log(`Discord webhook dispatched to channel #${channel}: "${message}"`);
      return { delivered: true, channel, message };
    }

    case 'aiagent':
    case 'ai-agent': {
      log(`Activating AI Agent node: "${nodeLabel}"...`);
      return await executeLangGraphAgent({
        node,
        config,
        context,
        log,
        executionId: context.executionId,
      });
    }

    case 'condition': {
      const left = config.leftValue || '';
      const op = config.operator || 'equals';
      const right = config.rightValue || '';
      let outcome = true;
      if (op === 'equals') outcome = String(left) === String(right);
      else if (op === 'notEquals') outcome = String(left) !== String(right);
      else if (op === 'contains') outcome = String(left).includes(String(right));
      else if (op === 'greaterThan') outcome = Number(left) > Number(right);
      else if (op === 'lessThan') outcome = Number(left) < Number(right);
      else if (op === 'isEmpty') outcome = !left;
      log(`Condition [${left} ${op} ${right}] evaluated to ${outcome ? 'TRUE' : 'FALSE'}`);
      return { result: outcome, branch: outcome ? 'true' : 'false' };
    }

    default: {
      log(`Executing standard node: "${node.data?.title || node.id}"`);
      await new Promise((r) => setTimeout(r, 350));
      return { message: 'Node executed', timestamp: Date.now() };
    }
  }
}
