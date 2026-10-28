import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';
import {
  disconnectIntegrationSession,
  getIntegrationSession,
  saveIntegrationSession,
} from '../../db/integrationSessionRepository.js';
import { upsertIntegrationConnection } from '../../db/workflowRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = path.resolve(__dirname, '../../../.gmail_session.json');
const REDIRECT_URI = 'http://localhost:4000/api/v1/gmail/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------
let oauthTokens = null;
let activeGmailUser = null;

export async function initializeGmailSession() {
  let session = await getIntegrationSession('gmail');
  if (!session) {
    try {
      const data = JSON.parse(await readFile(SESSION_FILE, 'utf8'));
      if (data.tokens) {
        await saveIntegrationSession('gmail', data.tokens, data.user || {});
        session = { payload: data.tokens, user: data.user || {} };
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        if (err.message.includes('SESSION_ENCRYPTION_KEY')) throw err;
        throw new Error('Could not import the existing Gmail session file', { cause: err });
      }
    }
  }
  if (session?.payload) {
    oauthTokens = session.payload;
    activeGmailUser = session.user;
    await upsertIntegrationConnection('gmail', activeGmailUser?.email, 'connected', SCOPES);
  }
}

// ---------------------------------------------------------------------------
// OAuth2 client helper
// ---------------------------------------------------------------------------
function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  return new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
}

function getAuthenticatedClient() {
  if (!oauthTokens) return null;
  const client = createOAuth2Client();
  if (!client) return null;
  client.setCredentials(oauthTokens);
  return client;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get the OAuth2 authorization URL */
export function getAuthUrl() {
  const client = createOAuth2Client();
  if (!client) throw new Error('Google OAuth credentials not configured in .env');

  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

/** Exchange authorization code for tokens */
export async function exchangeCode(code) {
  const client = createOAuth2Client();
  if (!client) throw new Error('Google OAuth credentials not configured in .env');

  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Fetch user profile
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data: userInfo } = await oauth2.userinfo.get();

  const user = {
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
  };

  await saveIntegrationSession('gmail', tokens, user);
  await upsertIntegrationConnection('gmail', user.email, 'connected', SCOPES);
  oauthTokens = tokens;
  activeGmailUser = user;

  return { user, tokens };
}

/** Clear the active Gmail session */
export async function clearGmailSession() {
  await disconnectIntegrationSession('gmail');
  await upsertIntegrationConnection('gmail', activeGmailUser?.email, 'disconnected');
  oauthTokens = null;
  activeGmailUser = null;
}

/** Check if Gmail is connected */
export function isGmailConnected() {
  return Boolean(oauthTokens);
}

/** Get the active Gmail user info */
export function getGmailUser() {
  return activeGmailUser;
}

/** Check whether Google OAuth credentials exist in env */
export function hasGoogleOAuthConfig() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim());
}

// ---------------------------------------------------------------------------
// Gmail operations
// ---------------------------------------------------------------------------

export function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatPlainTextToHtml(text) {
  if (!text) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return text;
  }

  const formatInline = (str) => {
    let safe = escapeHtml(str);
    safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/`([^`]+)`/g, '<code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 12px; color: #0f172a;">$1</code>');
    safe = safe.replace(/(https?:\/\/[^\s<"']+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; word-break: break-all;">$1</a>');
    safe = safe.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?![^<]*>)/g, '<a href="mailto:$1" style="color: #2563eb; text-decoration: none;">$1</a>');
    return safe;
  };

  const lines = text.split(/\r?\n/);
  const output = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      output.push(`<ul style="margin: 0 0 16px; padding-left: 20px; color: #334155;">${currentList.map((item) => `<li style="margin-bottom: 8px; line-height: 1.5;">${item}</li>`).join('')}</ul>`);
      currentList = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const itemContent = trimmed.replace(/^[-*]\s+/, '');
      const kvMatch = itemContent.match(/^([^:]+):\s*(.*)$/);
      if (kvMatch && !kvMatch[1].includes('http')) {
        const key = kvMatch[1].trim();
        const val = kvMatch[2].trim();
        currentList.push(`<strong>${formatInline(key)}:</strong> ${formatInline(val)}`);
      } else {
        currentList.push(formatInline(itemContent));
      }
    } else if (currentList.length > 0 && (/^\s{2,}/.test(rawLine) || !trimmed.endsWith(':'))) {
      currentList[currentList.length - 1] += `<br/>${formatInline(trimmed)}`;
    } else {
      flushList();
      if (trimmed.endsWith(':')) {
        output.push(`<p style="margin: 16px 0 8px; font-weight: 600; color: #0f172a; font-size: 14px;">${formatInline(trimmed)}</p>`);
      } else {
        output.push(`<p style="margin: 0 0 12px; line-height: 1.6; color: #334155;">${formatInline(trimmed)}</p>`);
      }
    }
  }

  flushList();
  return output.join('');
}

export function renderEmailHtml({ subject = '', body = '' } = {}) {
  if (!body) return '<p style="color:#64748b;">No content provided.</p>';

  const trimmed = typeof body === 'string' ? body.trim() : '';

  // Check if body is already a complete standalone HTML document
  if (/^<!DOCTYPE\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return body;
  }
  let formattedContent = '';
  let parsedJson = null;

  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      parsedJson = JSON.parse(trimmed);
    } catch {
      parsedJson = null;
    }
  } else if (typeof body === 'object' && body !== null) {
    parsedJson = body;
  }

  if (parsedJson) {
    if (parsedJson.status && parsedJson.data !== undefined) {
      const isSuccess = parsedJson.status >= 200 && parsedJson.status < 300;
      const statusBadge = `
        <div style="display: inline-block; padding: 4px 10px; font-size: 12px; font-weight: 600; border-radius: 4px; background-color: ${isSuccess ? '#ecfdf5' : '#fef2f2'}; color: ${isSuccess ? '#047857' : '#b91c1c'}; margin-bottom: 14px;">
          HTTP ${parsedJson.status} ${isSuccess ? 'Success' : 'Error'}
        </div>
      `;

      let dataContent = '';
      if (typeof parsedJson.data === 'string') {
        if (/<[^>]+>/.test(parsedJson.data)) {
          const clean = parsedJson.data
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          dataContent = `<div style="padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; line-height: 1.6; color: #334155;">${escapeHtml(clean.slice(0, 2000))}</div>`;
        } else {
          dataContent = `<div style="padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; line-height: 1.6; color: #334155; white-space: pre-wrap;">${escapeHtml(parsedJson.data)}</div>`;
        }
      } else {
        dataContent = `<pre style="margin: 0; padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; line-height: 1.5; color: #1e293b; overflow-x: auto; font-family: ui-monospace, Menlo, Monaco, Consolas, monospace;">${escapeHtml(JSON.stringify(parsedJson.data, null, 2))}</pre>`;
      }
      formattedContent = `${statusBadge}${dataContent}`;
    } else if (parsedJson.text || parsedJson.completion || parsedJson.output) {
      const text = parsedJson.text || parsedJson.completion || parsedJson.output;
      formattedContent = formatPlainTextToHtml(String(text));
    } else {
      formattedContent = `<pre style="margin: 0; padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; line-height: 1.5; color: #1e293b; overflow-x: auto; font-family: ui-monospace, Menlo, Monaco, Consolas, monospace;">${escapeHtml(JSON.stringify(parsedJson, null, 2))}</pre>`;
    }
  } else {
    formattedContent = formatPlainTextToHtml(String(body));
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(String(subject || 'Workflow Notification').replace(/[\r\n]+/g, ' ').trim())}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden;">
    <tr>
      <td style="padding: 20px 24px; background: #17120e; border-bottom: 2px solid #c69b45;">
        <span style="font-size: 16px; font-weight: 700; color: #f0e5c9; letter-spacing: 0.5px;">KAHN ENGINE</span>
        <span style="display: block; font-size: 11px; color: #a9997b; margin-top: 2px;">Automated Workflow Dispatch</span>
      </td>
    </tr>
    ${subject ? `
    <tr>
      <td style="padding: 16px 24px 8px; border-bottom: 1px solid #f1f5f9;">
        <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #0f172a; line-height: 1.4;">${escapeHtml(String(subject).replace(/[\r\n]+/g, ' ').trim())}</h2>
      </td>
    </tr>
    ` : ''}
    <tr>
      <td style="padding: 24px; font-size: 14px; line-height: 1.6; color: #334155;">
        ${formattedContent}
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
        Dispatched automatically by your Kahn Engine automated workflow pipeline.
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function formatRfc822Subject(subject) {
  const clean = String(subject || '').replace(/[\r\n]+/g, ' ').trim();
  if (/[^\x20-\x7E]/.test(clean)) {
    return `=?utf-8?B?${Buffer.from(clean, 'utf8').toString('base64')}?=`;
  }
  return clean || 'Workflow Notification';
}

function sanitizeHeader(val) {
  if (!val) return '';
  return String(val).replace(/[\r\n]+/g, '').trim();
}

/** Send an email */
export async function sendEmail({ to, subject, body, cc = '', bcc = '' }) {
  const auth = getAuthenticatedClient();
  if (!auth) throw new Error('Gmail not connected. Please authorize first.');

  const gmail = google.gmail({ version: 'v1', auth });
  const htmlContent = renderEmailHtml({ subject, body });

  const cleanTo = sanitizeHeader(to);
  const cleanCc = sanitizeHeader(cc);
  const cleanBcc = sanitizeHeader(bcc);
  const cleanSubject = formatRfc822Subject(subject);

  const headers = [
    `From: ${activeGmailUser?.email || 'me'}`,
    `To: ${cleanTo}`,
    cleanCc ? `Cc: ${cleanCc}` : null,
    cleanBcc ? `Bcc: ${cleanBcc}` : null,
    `Subject: ${cleanSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
  ].filter(Boolean);

  const rawMessage = Buffer.from(`${headers.join('\r\n')}\r\n\r\n${htmlContent}`, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const { data } = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: rawMessage },
  });

  return {
    success: true,
    messageId: data.id,
    threadId: data.threadId,
    labelIds: data.labelIds,
  };
}

/** Search emails */
export async function searchEmails({ query, maxResults = 10 }) {
  const auth = getAuthenticatedClient();
  if (!auth) throw new Error('Gmail not connected. Please authorize first.');

  const gmail = google.gmail({ version: 'v1', auth });

  const { data: listData } = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: Math.min(maxResults, 20),
  });

  if (!listData.messages || listData.messages.length === 0) {
    return { success: true, count: 0, messages: [] };
  }

  const messages = [];
  for (const msg of listData.messages.slice(0, 10)) {
    const { data: full } = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'metadata',
      metadataHeaders: ['From', 'To', 'Subject', 'Date'],
    });

    const headers = {};
    for (const h of full.payload?.headers || []) {
      headers[h.name.toLowerCase()] = h.value;
    }

    messages.push({
      id: full.id,
      threadId: full.threadId,
      from: headers.from || '',
      to: headers.to || '',
      subject: headers.subject || '',
      date: headers.date || '',
      snippet: full.snippet || '',
      labelIds: full.labelIds || [],
    });
  }

  return { success: true, count: messages.length, messages };
}

/** Reply to an email */
export async function replyToEmail({ messageId, body }) {
  const auth = getAuthenticatedClient();
  if (!auth) throw new Error('Gmail not connected. Please authorize first.');

  const gmail = google.gmail({ version: 'v1', auth });

  // Fetch the original message to get thread and headers
  const { data: original } = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['From', 'To', 'Subject', 'Message-ID'],
  });

  const headers = {};
  for (const h of original.payload?.headers || []) {
    headers[h.name.toLowerCase()] = h.value;
  }

  const replyTo = headers.from || '';
  const subject = headers.subject?.startsWith('Re:')
    ? headers.subject
    : `Re: ${headers.subject || ''}`;

  const htmlContent = renderEmailHtml({ subject, body });

  const cleanReplyTo = sanitizeHeader(replyTo);
  const cleanSubject = formatRfc822Subject(subject);
  const msgId = headers['message-id'] ? sanitizeHeader(headers['message-id']) : '';

  const headersList = [
    `From: ${activeGmailUser?.email || 'me'}`,
    `To: ${cleanReplyTo}`,
    `Subject: ${cleanSubject}`,
    msgId ? `In-Reply-To: ${msgId}` : null,
    msgId ? `References: ${msgId}` : null,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
  ].filter(Boolean);

  const rawMessage = Buffer.from(`${headersList.join('\r\n')}\r\n\r\n${htmlContent}`, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const { data } = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: rawMessage,
      threadId: original.threadId,
    },
  });

  return {
    success: true,
    messageId: data.id,
    threadId: data.threadId,
    repliedTo: messageId,
  };
}

/** Add a label to a message */
export async function addLabel({ messageId, labelName }) {
  const auth = getAuthenticatedClient();
  if (!auth) throw new Error('Gmail not connected. Please authorize first.');

  const gmail = google.gmail({ version: 'v1', auth });

  const { data } = await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      addLabelIds: [labelName],
    },
  });

  return {
    success: true,
    messageId: data.id,
    labelIds: data.labelIds,
  };
}
