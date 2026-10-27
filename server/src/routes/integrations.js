import { Octokit } from 'octokit';
import {
  getOctokit,
  hasGitHubToken,
  setOAuthToken,
  clearOAuthToken,
  getActiveUser,
} from '../engine/agent/octokitClient.js';

export async function integrationRoutes(fastify) {
  // Check GitHub integration connection status
  fastify.get('/api/integrations/github/status', async () => {
    const activeUser = getActiveUser();

    // 1. If user signed in via OAuth 2.0
    if (activeUser) {
      return {
        connected: true,
        authenticated: true,
        username: activeUser.login,
        name: activeUser.name,
        avatarUrl: activeUser.avatar_url,
        authType: 'oauth',
      };
    }

    // 2. If Personal Access Token is configured in server/.env
    if (process.env.GITHUB_TOKEN?.trim()) {
      try {
        const octokit = getOctokit();
        const { data } = await octokit.rest.users.getAuthenticated();
        return {
          connected: true,
          authenticated: true,
          username: data.login,
          name: data.name,
          avatarUrl: data.avatar_url,
          authType: 'token',
        };
      } catch {
        return {
          connected: true,
          authenticated: false,
          username: 'Token Configured (Check permissions)',
        };
      }
    }

    // 3. Unauthenticated / demo mode
    return {
      connected: false,
      authenticated: false,
      username: '',
      hasOAuthConfig: Boolean(process.env.GITHUB_CLIENT_ID),
      message: 'Connect your GitHub account to access private repositories and trigger workflows.',
    };
  });

  // Connect GitHub (OAuth 2.0 popup authorization)
  fastify.get('/api/integrations/github/connect', async (request, reply) => {
    const clientId = process.env.GITHUB_CLIENT_ID?.trim();
    if (clientId) {
      const redirectUri = 'http://localhost:4000/api/integrations/github/callback';
      const authUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=repo,read:user,user:email&redirect_uri=${encodeURIComponent(redirectUri)}`;
      return reply.redirect(authUrl);
    }

    // Fallback if no OAuth keys yet
    reply.type('text/html').send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GitHub Authorization - Kahn Engine</title>
          <style>
            body { font-family: system-ui, sans-serif; background: #100d0a; color: #f0e5c9; padding: 40px; text-align: center; }
            .badge { background: #d4ad58; color: #17120e; padding: 6px 14px; border-radius: 9999px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>⚡ Kahn Engine GitHub Integration</h2>
          <p><span class="badge">Octokit Connected (Demo)</span></p>
          <p>Connected with default workspace permissions.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'oauth-result', provider: 'github', connected: true }, '*');
            }
            setTimeout(() => { window.close(); }, 1200);
          </script>
        </body>
      </html>
    `);
  });

  // GitHub OAuth Callback Endpoint
  fastify.get('/api/integrations/github/callback', async (request, reply) => {
    const { code, error, error_description } = request.query || {};

    if (error || !code) {
      reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
          <body style="background:#100d0a;color:#e87979;font-family:sans-serif;padding:30px;text-align:center;">
            <h3>GitHub Authorization Failed</h3>
            <p>${error_description || error || 'No authorization code received'}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'oauth-result', provider: 'github', connected: false, error: '${error_description || error || 'Authorization failed'}' }, '*');
              }
              setTimeout(() => window.close(), 2500);
            </script>
          </body>
        </html>
      `);
      return;
    }

    try {
      const clientId = process.env.GITHUB_CLIENT_ID?.trim();
      const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();

      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        throw new Error(tokenData.error_description || tokenData.error || 'Failed to obtain access token from GitHub');
      }

      // Fetch user identity using the token
      const octokit = new Octokit({ auth: tokenData.access_token });
      const { data: user } = await octokit.rest.users.getAuthenticated();

      await setOAuthToken(
        tokenData.access_token,
        user,
        typeof tokenData.scope === 'string' ? tokenData.scope.split(' ') : [],
      );

      reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Connected to GitHub</title>
            <style>
              body { font-family: system-ui, sans-serif; background: #100d0a; color: #f0e5c9; padding: 40px; text-align: center; }
              .badge { background: #d4ad58; color: #17120e; padding: 6px 14px; border-radius: 9999px; font-weight: bold; }
              .avatar { width: 56px; height: 56px; border-radius: 50%; border: 2px solid #d4ad58; margin-bottom: 12px; }
            </style>
          </head>
          <body>
            ${user.avatar_url ? `<img src="${user.avatar_url}" class="avatar" alt="" />` : ''}
            <h2>⚡ Connected as @${user.login}</h2>
            <p><span class="badge">Octokit OAuth 2.0 Authenticated</span></p>
            <p>Welcome, ${user.name || user.login}! Your repositories and branches are now synchronized.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'oauth-result', provider: 'github', connected: true }, '*');
              }
              setTimeout(() => { window.close(); }, 1200);
            </script>
          </body>
        </html>
      `);
    } catch (err) {
      fastify.log.error({ code: err.code || 'UNKNOWN' }, 'GitHub OAuth exchange or session persistence failed');
      reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
          <body style="background:#100d0a;color:#e87979;font-family:sans-serif;padding:30px;text-align:center;">
            <h3>GitHub connection could not be completed</h3>
            <p>Please retry. If this continues, check the server configuration.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'oauth-result', provider: 'github', connected: false, error: 'GitHub connection could not be completed' }, '*');
              }
              setTimeout(() => window.close(), 2500);
            </script>
          </body>
        </html>
      `);
    }
  });

  // Disconnect GitHub
  fastify.post('/api/integrations/github/disconnect', async () => {
    await clearOAuthToken();
    return {
      connected: false,
      message: 'GitHub account disconnected successfully.',
    };
  });

  // List accessible repositories
  fastify.get('/api/integrations/github/repositories', async () => {
    const octokit = getOctokit();

    if (hasGitHubToken()) {
      try {
        const { data } = await octokit.rest.repos.listForAuthenticatedUser({
          sort: 'updated',
          per_page: 30,
        });
        return {
          repositories: data.map((repo) => ({
            id: String(repo.id),
            full_name: repo.full_name,
            name: repo.name,
            default_branch: repo.default_branch,
            private: repo.private,
          })),
        };
      } catch (err) {
        fastify.log.warn(`Authenticated repo list failed, falling back: ${err.message}`);
      }
    }

    // Default starter repositories if not authenticated
    return {
      repositories: [
        { id: '1', full_name: 'SYNTAXRUSH/kahn-engine', name: 'kahn-engine', default_branch: 'main', private: false },
        { id: '2', full_name: 'facebook/react', name: 'react', default_branch: 'main', private: false },
        { id: '3', full_name: 'vercel/next.js', name: 'next.js', default_branch: 'canary', private: false },
        { id: '4', full_name: 'langchain-ai/langchainjs', name: 'langchainjs', default_branch: 'main', private: false },
      ],
    };
  });

  // List branches for a specific repository
  fastify.get('/api/integrations/github/repositories/:owner/:repo/branches', async (request) => {
    const { owner, repo } = request.params;
    const octokit = getOctokit();

    try {
      const { data } = await octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: 30,
      });

      return {
        branches: data.map((b) => ({
          name: b.name,
          commitSha: b.commit?.sha?.substring(0, 7),
        })),
      };
    } catch {
      return {
        branches: [
          { name: 'main', commitSha: 'f4d9a1c' },
          { name: 'dev', commitSha: 'e8d19ab' },
        ],
      };
    }
  });
}
