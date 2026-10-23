import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Octokit } from 'octokit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = path.resolve(__dirname, '../../../.github_session.json');

function loadSavedSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
      if (data.token) {
        return data;
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

const initialSession = loadSavedSession();
let cachedOctokit = null;
let userOAuthToken = initialSession?.token || null;
let activeUser = initialSession?.user || null;

export function setOAuthToken(token, user = null) {
  userOAuthToken = token;
  activeUser = user;
  cachedOctokit = new Octokit({ auth: token });
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ token, user }, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not persist GitHub session to file:', err.message);
  }
}

export function clearOAuthToken() {
  userOAuthToken = null;
  activeUser = null;
  cachedOctokit = null;
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
  } catch {}
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
