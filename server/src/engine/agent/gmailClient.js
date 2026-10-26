import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = path.resolve(__dirname, '../../../.gmail_session.json');
export function getRedirectUri() {
  return process.env.GOOGLE_REDIRECT_URI?.trim() || 'http://localhost:4000/api/v1/gmail/callback';
}

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
function loadSavedSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
      if (data.tokens) return data;
    }
  } catch {
    // Ignore
  }
  return null;
}

const initialSession = loadSavedSession();
let oauthTokens = initialSession?.tokens || null;
let activeGmailUser = initialSession?.user || null;

// ---------------------------------------------------------------------------
// OAuth2 client helper
// ---------------------------------------------------------------------------
function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
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

  oauthTokens = tokens;
  activeGmailUser = {
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
  };

  // Persist session
  try {
    fs.writeFileSync(
      SESSION_FILE,
      JSON.stringify({ tokens, user: activeGmailUser }, null, 2),
      'utf-8',
    );
  } catch (err) {
    console.warn('Could not persist Gmail session:', err.message);
  }

  return { user: activeGmailUser, tokens };
}

/** Clear the active Gmail session */
export function clearGmailSession() {
  oauthTokens = null;
  activeGmailUser = null;
  try {
    if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
  } catch {
    // Ignore
  }
}

/** Check if Gmail is connected */
export function isGmailConnected() {
  return Boolean(oauthTokens && getAuthenticatedClient());
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

/** Send an email */
export async function sendEmail({ to, subject, body, cc = '', bcc = '' }) {
  const auth = getAuthenticatedClient();
  if (!auth) throw new Error('Gmail not connected. Please authorize first.');

  const gmail = google.gmail({ version: 'v1', auth });

  const messageParts = [
    `From: ${activeGmailUser?.email || 'me'}`,
    `To: ${to}`,
    cc ? `Cc: ${cc}` : '',
    bcc ? `Bcc: ${bcc}` : '',
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    body,
  ].filter(Boolean);

  const rawMessage = Buffer.from(messageParts.join('\r\n'))
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

  const messageParts = [
    `From: ${activeGmailUser?.email || 'me'}`,
    `To: ${replyTo}`,
    `Subject: ${subject}`,
    `In-Reply-To: ${headers['message-id'] || ''}`,
    `References: ${headers['message-id'] || ''}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    body,
  ];

  const rawMessage = Buffer.from(messageParts.join('\r\n'))
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
