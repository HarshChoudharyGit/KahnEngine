import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Octokit } from 'octokit';
import {
  disconnectIntegrationSession,
  getIntegrationSession,
  saveIntegrationSession,
} from '../../db/integrationSessionRepository.js';
import { upsertIntegrationConnection } from '../../db/workflowRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = path.resolve(__dirname, '../../../.github_session.json');

let cachedOctokit = null;
let userOAuthToken = null;
let activeUser = null;

export async function initializeGitHubSession() {
  let session = await getIntegrationSession('github');
  if (!session) {
    try {
      const data = JSON.parse(await readFile(SESSION_FILE, 'utf8'));
      if (data.token) {
        await saveIntegrationSession('github', { token: data.token, scopes: data.scopes || [] }, data.user || {});
        session = { payload: { token: data.token, scopes: data.scopes || [] }, user: data.user || {} };
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        if (err.message.includes('SESSION_ENCRYPTION_KEY')) throw err;
        throw new Error('Could not import the existing GitHub session file', { cause: err });
      }
    }
  }
  if (session?.payload?.token) {
    userOAuthToken = session.payload.token;
    activeUser = session.user;
    cachedOctokit = new Octokit({ auth: userOAuthToken });
    await upsertIntegrationConnection('github', activeUser?.login, 'connected', session.payload.scopes || []);
  }
}

export async function setOAuthToken(token, user = null, scopes = []) {
  await saveIntegrationSession('github', { token, scopes }, user || {});
  await upsertIntegrationConnection('github', user?.login, 'connected', scopes);
  userOAuthToken = token;
  activeUser = user;
  cachedOctokit = new Octokit({ auth: token });
}

export async function clearOAuthToken() {
  await disconnectIntegrationSession('github');
  await upsertIntegrationConnection('github', activeUser?.login, 'disconnected');
  userOAuthToken = null;
  activeUser = null;
  cachedOctokit = null;
}

export function getActiveUser() {
  return activeUser;
}

export function getOctokit() {
  if (userOAuthToken) {
    if (!cachedOctokit) cachedOctokit = new Octokit({ auth: userOAuthToken });
    return cachedOctokit;
  }
  if (!cachedOctokit) {
    const token = process.env.GITHUB_TOKEN?.trim();
    cachedOctokit = token ? new Octokit({ auth: token }) : new Octokit();
  }
  return cachedOctokit;
}

export function hasGitHubToken() {
  return Boolean(userOAuthToken || process.env.GITHUB_TOKEN?.trim());
}

/**
 * Parses "owner/repo" or separates owner & repo.
 */
function parseRepoString(repoInput) {
  if (!repoInput) throw new Error('Repository parameter is required (format: "owner/repo")');
  const parts = repoInput.split('/').map((s) => s.trim());
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid repository format: "${repoInput}". Expected "owner/repo" (e.g., "facebook/react")`);
  }
  return { owner: parts[0], repo: parts[1] };
}

/**
 * Fetch general repository information
 */
export async function getRepoInfo(repoInput) {
  const { owner, repo } = parseRepoString(repoInput);
  const octokit = getOctokit();

  try {
    const { data } = await octokit.rest.repos.get({ owner, repo });
    return {
      success: true,
      authenticated: hasGitHubToken(),
      repository: data.full_name,
      description: data.description,
      defaultBranch: data.default_branch,
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssuesCount: data.open_issues_count,
      language: data.language,
      isPrivate: data.private,
      htmlUrl: data.html_url,
      updatedAt: data.updated_at,
    };
  } catch (err) {
    return {
      success: false,
      repository: repoInput,
      error: err.message,
      status: err.status || 500,
      authenticated: hasGitHubToken(),
    };
  }
}

/**
 * Fetch the latest commit for a repository
 */
export async function getLatestCommit(repoInput, branch = null) {
  const { owner, repo } = parseRepoString(repoInput);
  const octokit = getOctokit();

  try {
    const params = { owner, repo, per_page: 1 };
    if (branch) params.sha = branch;

    const { data } = await octokit.rest.repos.listCommits(params);
    if (!data || data.length === 0) {
      return { success: false, repository: repoInput, error: 'No commits found' };
    }

    const commit = data[0];
    return {
      success: true,
      authenticated: hasGitHubToken(),
      repository: `${owner}/${repo}`,
      sha: commit.sha.substring(0, 7),
      fullSha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author?.name || commit.author?.login || 'unknown',
      date: commit.commit.author?.date,
      htmlUrl: commit.html_url,
    };
  } catch (err) {
    return {
      success: false,
      repository: repoInput,
      error: err.message,
      status: err.status || 500,
    };
  }
}

/**
 * List recent issues / PRs
 */
export async function listIssues(repoInput, state = 'open', limit = 5) {
  const { owner, repo } = parseRepoString(repoInput);
  const octokit = getOctokit();

  try {
    const { data } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state,
      per_page: Math.min(limit, 20),
    });

    return {
      success: true,
      authenticated: hasGitHubToken(),
      repository: `${owner}/${repo}`,
      count: data.length,
      issues: data.map((issue) => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        isPullRequest: Boolean(issue.pull_request),
        author: issue.user?.login,
        commentsCount: issue.comments,
        createdAt: issue.created_at,
        htmlUrl: issue.html_url,
      })),
    };
  } catch (err) {
    return {
      success: false,
      repository: repoInput,
      error: err.message,
      status: err.status || 500,
    };
  }
}

/**
 * Create an issue on a repository (requires write token)
 */
export async function createIssue(repoInput, title, body = '') {
  if (!hasGitHubToken()) {
    return {
      success: false,
      repository: repoInput,
      error: 'GitHub token (GITHUB_TOKEN) is required in server/.env to create issues.',
    };
  }

  const { owner, repo } = parseRepoString(repoInput);
  const octokit = getOctokit();

  try {
    const { data } = await octokit.rest.issues.create({
      owner,
      repo,
      title,
      body,
    });

    return {
      success: true,
      authenticated: true,
      issueNumber: data.number,
      title: data.title,
      htmlUrl: data.html_url,
      createdAt: data.created_at,
    };
  } catch (err) {
    return {
      success: false,
      repository: repoInput,
      error: err.message,
      status: err.status || 500,
    };
  }
}
