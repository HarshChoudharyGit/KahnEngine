/* eslint-disable react-refresh/only-export-components -- This module combines node data with their icon components. */
import {
  GitCommit,
  GitPullRequest,
  GitBranch,
  GitFork,
  Mail,
  MessageCircle,
  Send,
  Webhook,
  MessageSquare,
} from 'lucide-react'

// App brand logos (clean inline SVGs for authentic n8n look)
export const GithubBrandIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
)

export const GmailBrandIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
  </svg>
)

export const SlackBrandIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M6 15a2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2h2v2zm1 0a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-5zm2-7a2 2 0 0 1-2-2 2 2 0 0 1 2-2 2 2 0 0 1 2 2v2H9zm0 1a2 2 0 0 1 2 2 2 2 0 0 1-2 2H4a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5zm7-2a2 2 0 0 1 2-2 2 2 0 0 1 2 2 2 2 0 0 1-2 2h-2V7zm-1 0a2 2 0 0 1-2 2 2 2 0 0 1-2-2V2a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5zm-2 7a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2v-2h2zm0-1a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-5z" />
  </svg>
)

export const WebhookBrandIcon = ({ className = 'w-4 h-4', ...props }) => (
  <Webhook className={className} {...props} />
)

// Pre-seeded Mock Connected Accounts (Frontend state)
export const initialCredentials = {
  github: [
    {
      id: 'cred_gh_asus',
      provider: 'github',
      username: 'Asus',
      name: 'Asus Developer',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      connected: true,
      scope: 'repo, admin:repo_hook, user:read',
      connectedAt: '2026-10-21 14:15:00',
    },
  ],
  gmail: [
    {
      id: 'cred_gm_asus',
      provider: 'gmail',
      email: 'developer.asus@gmail.com',
      name: 'Asus Tech Lead',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      connected: true,
      scope: 'https://mail.google.com/',
      connectedAt: '2026-10-21 14:20:00',
    },
  ],
}

// User's Trackable GitHub Repositories
export const sampleGithubRepos = [
  {
    fullName: 'Asus/CodeSangam',
    name: 'CodeSangam',
    owner: 'Asus',
    description: 'Autonomous workflow orchestration and visual node pipeline',
    isPrivate: false,
    defaultBranch: 'main',
    branches: ['main', 'feat/n8n-style-triggers', 'dev', 'release/v1.2'],
  },
  {
    fullName: 'Asus/workflow-engine-core',
    name: 'workflow-engine-core',
    owner: 'Asus',
    description: 'High-throughput event execution daemon',
    isPrivate: true,
    defaultBranch: 'main',
    branches: ['main', 'staging'],
  },
  {
    fullName: 'Asus/dormammu-loop',
    name: 'dormammu-loop',
    owner: 'Asus',
    description: 'Time-loop state machine with AI branching',
    isPrivate: false,
    defaultBranch: 'master',
    branches: ['master', 'v2-canary'],
  },
  {
    fullName: 'Asus/client-dashboard',
    name: 'client-dashboard',
    owner: 'Asus',
    description: 'Frontend React + Tailwind application',
    isPrivate: true,
    defaultBranch: 'main',
    branches: ['main', 'preview'],
  },
]

// Comprehensive App Definitions with dedicated Triggers and Actions (n8n Style)
export const APP_DEFINITIONS = [
  {
    id: 'github',
    name: 'GitHub',
    category: 'APPS',
    badge: 'Popular Trigger',
    accent: '#a855f7',
    icon: GithubBrandIcon,
    description: 'Trigger workflows from Git pushes, pull requests, issues, or releases.',
    supportsAuth: true,
    authProvider: 'github',
    authLabel: 'GitHub Account',
    triggers: [
      {
        id: 'github_push',
        name: 'On Git Push',
        tag: 'git push',
        summary: 'Triggers when commits are pushed to a repository or branch.',
        icon: GitCommit,
        defaultParams: {
          repo: 'Asus/CodeSangam',
          branch: 'main',
          filterPaths: '',
          includeDraftCommits: false,
        },
      },
      {
        id: 'github_pull_request',
        name: 'On Pull Request',
        tag: 'pull request',
        summary: 'Triggers when a PR is opened, closed, merged, or labeled.',
        icon: GitPullRequest,
        defaultParams: {
          repo: 'Asus/CodeSangam',
          actionTypes: 'opened, synchronize',
          targetBranch: 'main',
        },
      },
      {
        id: 'github_issue',
        name: 'On Issue Created',
        tag: 'issues',
        summary: 'Triggers when an issue is opened, assigned, or labeled.',
        icon: GitBranch,
        defaultParams: {
          repo: 'Asus/CodeSangam',
          events: 'opened',
        },
      },
      {
        id: 'github_release',
        name: 'On Release Published',
        tag: 'release',
        summary: 'Triggers when a new version tag or release is published.',
        icon: GitFork,
        defaultParams: {
          repo: 'Asus/CodeSangam',
          tagFilter: 'v*',
        },
      },
    ],
    actions: [
      {
        id: 'github_create_issue',
        name: 'Create Issue',
        summary: 'Create a new issue in the tracked GitHub repository.',
        icon: GitBranch,
      },
      {
        id: 'github_create_comment',
        name: 'Create PR/Issue Comment',
        summary: 'Comment on a PR or issue after automated processing.',
        icon: MessageSquare,
      },
    ],
  },
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'APPS',
    badge: 'Popular Trigger',
    accent: '#ef4444',
    icon: GmailBrandIcon,
    description: 'Trigger on new emails, attachments, or send automated responses.',
    supportsAuth: true,
    authProvider: 'gmail',
    authLabel: 'Google Account',
    triggers: [
      {
        id: 'gmail_new_email',
        name: 'On New Email Received',
        tag: 'new email',
        summary: 'Triggers whenever an incoming email arrives matching filters.',
        icon: Mail,
        defaultParams: {
          label: 'INBOX',
          query: 'is:unread',
          markAsRead: false,
        },
      },
      {
        id: 'gmail_starred',
        name: 'On Email Starred',
        tag: 'starred',
        summary: 'Triggers when an email or conversation is marked with a star.',
        icon: Mail,
        defaultParams: {
          label: 'STARRED',
        },
      },
      {
        id: 'gmail_attachment',
        name: 'On New Attachment',
        tag: 'attachment',
        summary: 'Triggers when an email containing documents or files is received.',
        icon: Mail,
        defaultParams: {
          fileTypes: '.json, .pdf, .zip',
        },
      },
    ],
    actions: [
      {
        id: 'gmail_send_message',
        name: 'Send Email',
        summary: 'Send an email with custom HTML or templated text body.',
        icon: Send,
      },
    ],
  },
  {
    id: 'discord',
    name: 'Discord',
    category: 'APPS',
    badge: 'Messaging',
    accent: '#7289da',
    icon: MessageCircle,
    description: 'Send workflow notifications to a Discord channel.',
    supportsAuth: false,
    triggers: [],
    actions: [
      {
        id: 'discord_send_message',
        name: 'Send Message',
        summary: 'Post a message to a Discord channel.',
        icon: MessageCircle,
      },
    ],
  },
]
