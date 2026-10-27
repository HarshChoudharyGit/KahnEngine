import {
  getAuthUrl,
  exchangeCode,
  clearGmailSession,
  isGmailConnected,
  getGmailUser,
  hasGoogleOAuthConfig,
  sendEmail,
  searchEmails,
} from '../engine/agent/gmailClient.js';

export async function gmailRoutes(fastify) {
  // -----------------------------------------------------------------------
  // Status — check if Gmail is connected
  // -----------------------------------------------------------------------
  fastify.get('/api/v1/gmail/status', async () => {
    const user = getGmailUser();
    if (isGmailConnected() && user) {
      return {
        connected: true,
        email: user.email,
        name: user.name,
        picture: user.picture,
      };
    }

    return {
      connected: false,
      email: '',
      hasOAuthConfig: hasGoogleOAuthConfig(),
      message: 'Connect your Google account to send and receive emails.',
    };
  });

  // -----------------------------------------------------------------------
  // Connect — redirect to Google OAuth consent screen
  // -----------------------------------------------------------------------
  fastify.get('/api/v1/gmail/connect', async (request, reply) => {
    try {
      const authUrl = getAuthUrl();
      return reply.redirect(authUrl);
    } catch (err) {
      reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
          <body style="background:#100d0a;color:#e87979;font-family:sans-serif;padding:30px;text-align:center;">
            <h3>Gmail Configuration Error</h3>
            <p>${err.message}</p>
            <p>Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your server/.env file.</p>
            <script>
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `);
    }
  });

  // -----------------------------------------------------------------------
  // Callback — exchange authorization code for tokens
  // -----------------------------------------------------------------------
  fastify.get('/api/v1/gmail/callback', async (request, reply) => {
    const { code, error, error_description } = request.query || {};

    if (error || !code) {
      reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
          <body style="background:#100d0a;color:#e87979;font-family:sans-serif;padding:30px;text-align:center;">
            <h3>Google Authorization Failed</h3>
            <p>${error_description || error || 'No authorization code received'}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'oauth-result', provider: 'gmail', connected: false, error: '${(error_description || error || 'Authorization failed').replace(/'/g, "\\'")}' }, '*');
              }
              setTimeout(() => window.close(), 2500);
            </script>
          </body>
        </html>
      `);
      return;
    }

    try {
      const { user } = await exchangeCode(code);

      reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Connected to Gmail</title>
            <style>
              body { font-family: system-ui, sans-serif; background: #100d0a; color: #f0e5c9; padding: 40px; text-align: center; }
              .badge { background: #d4ad58; color: #17120e; padding: 6px 14px; border-radius: 9999px; font-weight: bold; }
              .avatar { width: 56px; height: 56px; border-radius: 50%; border: 2px solid #d4ad58; margin-bottom: 12px; }
            </style>
          </head>
          <body>
            ${user.picture ? `<img src="${user.picture}" class="avatar" alt="" />` : ''}
            <h2>⚡ Connected as ${user.email}</h2>
            <p><span class="badge">Gmail OAuth 2.0 Authorized</span></p>
            <p>Welcome, ${user.name || user.email}! Your Gmail account is now connected to Kahn Engine.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'oauth-result', provider: 'gmail', connected: true }, '*');
              }
              setTimeout(() => { window.close(); }, 1500);
            </script>
          </body>
        </html>
      `);
    } catch (err) {
      fastify.log.error({ code: err.code || 'UNKNOWN' }, 'Gmail OAuth exchange or session persistence failed');
      reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
          <body style="background:#100d0a;color:#e87979;font-family:sans-serif;padding:30px;text-align:center;">
            <h3>Gmail connection could not be completed</h3>
            <p>Please retry. If this continues, check the server configuration.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'oauth-result', provider: 'gmail', connected: false, error: 'Gmail connection could not be completed' }, '*');
              }
              setTimeout(() => window.close(), 2500);
            </script>
          </body>
        </html>
      `);
    }
  });

  // -----------------------------------------------------------------------
  // Disconnect — clear Gmail session
  // -----------------------------------------------------------------------
  fastify.post('/api/v1/gmail/disconnect', async () => {
    await clearGmailSession();
    return {
      connected: false,
      message: 'Gmail account disconnected successfully.',
    };
  });

  // -----------------------------------------------------------------------
  // Send email — used by the executor and for manual testing
  // -----------------------------------------------------------------------
  fastify.post('/api/v1/gmail/send', async (request) => {
    const { to, subject, body, cc, bcc } = request.body || {};

    if (!to || !subject) {
      return { success: false, error: 'Recipient (to) and subject are required.' };
    }

    try {
      const result = await sendEmail({ to, subject, body: body || '', cc, bcc });
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // -----------------------------------------------------------------------
  // Search emails — used by search_emails operation
  // -----------------------------------------------------------------------
  fastify.get('/api/v1/gmail/search', async (request) => {
    const { q, maxResults } = request.query || {};

    try {
      const result = await searchEmails({
        query: q || 'is:unread',
        maxResults: Number(maxResults) || 10,
      });
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}
