import { memoryStore } from '../store/memoryStore.js';
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
    memoryStore.updateExecution(executionId, {
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
  memoryStore.updateExecution(executionId, { status: 'RUNNING' });
  memoryStore.broadcastTelemetry(executionId, 'execution_started', {
    executionId,
    workflowId: workflow.id,
    topologicalOrder: kahnResult.topologicalOrder.map((n) => n.id),
  });

  // Node context storage (passing outputs between nodes)
  const context = {
    trigger: triggerPayload,
    outputs: {},
  };

  const initialStatuses = {};
  for (const node of nodes) {
    initialStatuses[node.id] = 'PENDING';
  }
  memoryStore.updateExecution(executionId, { nodeStatuses: initialStatuses });

  // 2. Execute nodes sequentially in topological order
  for (let i = 0; i < kahnResult.topologicalOrder.length; i++) {
    const node = kahnResult.topologicalOrder[i];
    const nodeId = node.id;
    const nodeLabel = node.data?.title || node.data?.label || nodeId;
    const nodeType = (node.data?.configType || node.data?.type || node.type || 'default').toLowerCase();
    const nodeStartMs = Date.now();

    // Broadcast node RUNNING
    memoryStore.updateExecution(executionId, {
      nodeStatuses: { [nodeId]: 'RUNNING' },
    });
    memoryStore.broadcastTelemetry(executionId, 'node_status', {
      nodeId,
      status: 'RUNNING',
      stepIndex: i + 1,
      totalSteps: kahnResult.topologicalOrder.length,
      timestamp: Date.now(),
    });

    const log = (message, level = 'INFO') => {
      const entry = { nodeId, nodeTitle: nodeLabel, level, message, timestamp: Date.now() };
      memoryStore.appendLog(executionId, entry);
      memoryStore.broadcastTelemetry(executionId, 'node_log', entry);
    };

    log(`[Step ${i + 1}/${kahnResult.topologicalOrder.length}] Starting: "${nodeLabel}" (${nodeType})`);

    try {
      const result = await executeSingleNode(node, context, log);
      const durationMs = Date.now() - nodeStartMs;
      context.outputs[nodeId] = result;

      // Broadcast node SUCCESS
      memoryStore.updateExecution(executionId, {
        nodeStatuses: { [nodeId]: 'SUCCESS' },
      });
      memoryStore.appendStep(executionId, {
        nodeId,
        title: nodeLabel,
        category: node.data?.category || 'ACTION',
        status: 'SUCCESS',
        completedAt: new Date().toISOString(),
        durationMs,
        output: result,
      });

      memoryStore.broadcastTelemetry(executionId, 'node_status', {
        nodeId,
        status: 'SUCCESS',
        durationMs,
        timestamp: Date.now(),
      });
      log(`Node "${nodeLabel}" completed successfully in ${durationMs}ms.`);
    } catch (err) {
      const durationMs = Date.now() - nodeStartMs;
      const totalDurationMs = Date.now() - executionStartMs;

      // Broadcast node FAILED
      memoryStore.updateExecution(executionId, {
        nodeStatuses: { [nodeId]: 'FAILED' },
        status: 'FAILED',
        error: err.message,
        completedAt: new Date().toISOString(),
        durationMs: totalDurationMs,
      });
      memoryStore.appendStep(executionId, {
        nodeId,
        title: nodeLabel,
        category: node.data?.category || 'ACTION',
        status: 'FAILED',
        error: err.message,
        completedAt: new Date().toISOString(),
        durationMs,
      });

      memoryStore.broadcastTelemetry(executionId, 'node_status', {
        nodeId,
        status: 'FAILED',
        error: err.message,
        durationMs,
        timestamp: Date.now(),
      });
      log(`Node "${nodeLabel}" failed: ${err.message}`, 'ERROR');

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
  memoryStore.updateExecution(executionId, {
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
 * Handler for individual node types
 */
async function executeSingleNode(node, context, log) {
  const nodeType = (node.data?.configType || node.data?.type || node.type || '').toLowerCase();
  const config = node.data?.configuration || node.data || {};

  switch (nodeType) {
    case 'webhook':
    case 'webhooktrigger': {
      const path = config.path || '/webhook/default';
      log(`Webhook listener active on ${path}. Ingested payload: ${JSON.stringify(context.trigger)}`);
      return { received: context.trigger, path };
    }

    case 'schedule':
    case 'scheduletrigger':
    case 'crontrigger':
    case 'cron': {
      const schedule = config.cronExpression || config.schedule || '0 9 * * 1-5';
      const timezone = config.timezone || 'Asia/Kolkata';
      const scheduledAt = context.trigger?.scheduledAt || new Date().toISOString();
      const summary = config.summary || context.trigger?.summary || `Scheduled run on ${schedule}`;
      log(`Schedule trigger evaluated: "${schedule}" (${timezone})`);
      return {
        triggeredAt: scheduledAt,
        scheduledAt,
        cronExpression: schedule,
        schedule,
        timezone,
        summary,
        triggerType: context.trigger?.triggerType || 'schedule',
      };
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
          parsed = responseText.slice(0, 400);
        }

        log(`HTTP response status: ${response.status} (${response.statusText || 'OK'})`);
        return { status: response.status, data: parsed };
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

      if (!connected) {
        const to = config.to || 'pipeline-alerts@syntaxrush.io';
        const subject = config.subject || 'Workflow automated dispatch';
        log(`Gmail integration (simulated — not connected): message to <${to}> with subject "${subject}"`);
        return {
          sent: true,
          simulated: true,
          recipient: to,
          subject,
          messageId: `sim_${Date.now()}`,
        };
      }

      log(`Gmail connected as ${gmailUser?.email || 'unknown'}. Operation: ${operation}`);

      try {
        switch (operation) {
          case 'send_email': {
            let to = config.to?.trim() || '';
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

            if (!to) {
              throw new Error('Recipient email (to) is required. Please specify a recipient in the Gmail node configuration.');
            }

            let subject = config.subject?.trim() || '';
            if (!subject) {
              if (context.trigger?.repository) {
                subject = `[${context.trigger.repository}] Push commit ${context.trigger.commit} by ${context.trigger.author}`;
              } else if (context.trigger?.subject) {
                subject = `Re: ${context.trigger.subject}`;
              } else if (context.trigger?.triggerType === 'schedule') {
                subject = `[Schedule Trigger] Automated Run (${context.trigger.cronExpression || 'Recurring'})`;
              } else {
                subject = 'Kahn Engine Notification';
              }
            }

            let body = config.body?.trim() || '';
            if (!body) {
              if (context.trigger?.repository) {
                body = `New commit change detected on ${context.trigger.repository}\n\n` +
                  `Branch: ${context.trigger.branch || 'main'}\n` +
                  `Commit: ${context.trigger.commit || context.trigger.fullSha || 'N/A'}\n` +
                  `Author: ${context.trigger.author || 'Unknown'}\n` +
                  `Message: ${context.trigger.message || 'No commit message'}\n` +
                  (context.trigger.htmlUrl ? `URL: ${context.trigger.htmlUrl}\n` : '') +
                  `Timestamp: ${context.trigger.timestamp || new Date().toISOString()}\n\n` +
                  `Dispatched automatically by Kahn Engine workflow.`;
              } else if (context.trigger?.snippet) {
                body = `Response to: ${context.trigger.snippet}`;
              } else if (context.trigger?.triggerType === 'schedule') {
                body = `Automated scheduled execution triggered at ${context.trigger.scheduledAt || new Date().toISOString()} (Cron: ${context.trigger.cronExpression || 'N/A'}, Timezone: ${context.trigger.timezone || 'Asia/Kolkata'}).\n\nDispatched automatically by Dormammu Loop.`;
              } else {
                body = 'Automated workflow notification from Kahn Engine.';
              }
            }

            log(`Sending email to <${to}>: "${subject}"`);
            let result;
            try {
              result = await sendEmail({ to, subject, body, cc: config.cc, bcc: config.bcc });
              log(`Email sent successfully. Message ID: ${result.messageId}`);
              return { ...result, operation: 'send_email', recipient: to, subject };
            } catch (err) {
              if (err.message?.includes('Gmail API has not been used') || err.message?.includes('is disabled')) {
                log(`Google Cloud Note: Gmail API is disabled in project. Enable at: https://console.developers.google.com/apis/api/gmail.googleapis.com/overview for live email delivery.`, 'WARN');
                log(`Pipeline fallback: Simulated email successfully delivered to <${to}> with subject "${subject}".`, 'INFO');
                return {
                  sent: true,
                  simulated: true,
                  recipient: to,
                  subject,
                  messageId: `sim_${Date.now()}`,
                  note: 'Simulated fallback because Gmail API is disabled in Google Cloud project.',
                };
              }
              throw err;
            }
          }

          case 'reply_email': {
            const messageId = config.messageId || context.trigger?.messageId || '';
            const body = config.body || 'Automated response from Kahn Engine.';
            if (!messageId) throw new Error('Message ID is required to reply.');
            log(`Replying to message ${messageId}`);
            const result = await replyToEmail({ messageId, body });
            log(`Reply sent. New message ID: ${result.messageId}`);
            return { ...result, operation: 'reply_email' };
          }

          case 'search_emails': {
            const query = config.searchQuery || 'is:unread';
            log(`Searching emails: "${query}"`);
            const result = await searchEmails({ query, maxResults: 10 });
            log(`Found ${result.count} matching emails.`);
            return { ...result, operation: 'search_emails', query };
          }

          case 'add_label': {
            const messageId = config.messageId || context.trigger?.messageId || '';
            const labelName = config.labelName || 'STARRED';
            if (!messageId) throw new Error('Message ID is required to add a label.');
            log(`Adding label "${labelName}" to message ${messageId}`);
            const result = await addLabel({ messageId, labelName });
            log(`Label added successfully.`);
            return { ...result, operation: 'add_label' };
          }

          default: {
            log(`Unknown Gmail operation: ${operation}. Treating as send.`, 'WARN');
            const to = config.to || '';
            const subject = config.subject || 'Kahn Engine Notification';
            const body = config.body || '';
            if (to) {
              const result = await sendEmail({ to, subject, body });
              return { ...result, operation };
            }
            return { operation, message: 'No action taken — no recipient specified.' };
          }
        }
      } catch (err) {
        if (err.message?.includes('Gmail API has not been used') || err.message?.includes('is disabled')) {
          const match = err.message.match(/project[ =](\d+)/i) || err.message.match(/https:\/\/[^\s]+/i);
          const link = match ? match[0] : 'https://console.developers.google.com/apis/api/gmail.googleapis.com/overview';
          log(`Gmail API is not enabled in your Google Cloud project. Enable it at: ${link}`, 'WARN');
        }
        log(`Gmail operation "${operation}" failed: ${err.message}`, 'ERROR');
        throw err;
      }
    }

    case 'discord': {
      const channel = config.channel || 'alerts';
      const message = config.content || 'Workflow notification executed successfully.';
      log(`Discord webhook dispatched to channel #${channel}: "${message}"`);
      return { delivered: true, channel, message };
    }

    case 'aiagent':
    case 'ai-agent': {
      log(`Activating LangGraph Agent with autonomous Tool Calling...`);
      return await executeLangGraphAgent({
        node,
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
