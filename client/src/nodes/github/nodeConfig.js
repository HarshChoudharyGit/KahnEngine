const githubTriggerConfig = {
  label: 'GitHub Trigger',
  description: 'Start a workflow when activity occurs in a repository.',
  defaults: {
    repository: '',
    branch: 'main',
    events: ['push'],
    branchesInclude: '',
    branchesIgnore: '',
    includeDrafts: false,
  },
  fields: [
    {
      key: 'githubConnection',
      label: 'GitHub connection',
      type: 'integration',
      description: 'OAuth connection is managed by your workspace backend.',
    },
    {
      key: 'repository',
      label: 'Repository',
      type: 'select',
      placeholder: 'Choose an example repository',
      options: [
        { value: '', label: 'Select repository' },
        { value: 'dormammu-loop/workflows', label: 'dormammu-loop/workflows (example)' },
        { value: 'dormammu-loop/integrations', label: 'dormammu-loop/integrations (example)' },
        { value: 'your-org/your-repository', label: 'your-org/your-repository (example)' },
      ],
      description: 'Example repositories only. Connect a backend to load your repositories.',
      required: true,
    },
    {
      key: 'branch',
      label: 'Branch',
      type: 'select',
      options: [
        { value: 'main', label: 'main' },
        { value: 'develop', label: 'develop' },
        { value: 'release/*', label: 'release/*' },
      ],
    },
    {
      key: 'events',
      label: 'Events',
      type: 'multiselect',
      options: [
        { value: 'push', label: 'Push' },
        { value: 'pull_request', label: 'Pull Request' },
        { value: 'issues', label: 'Issue Created' },
        { value: 'release', label: 'Release Published' },
      ],
      required: true,
    },
    {
      key: 'branchesInclude',
      label: 'Only these branches',
      type: 'text',
      placeholder: 'feature/*, release/*',
      description: 'Comma-separated branch patterns. Leave empty to include all branches.',
    },
    {
      key: 'branchesIgnore',
      label: 'Ignore these branches',
      type: 'text',
      placeholder: 'experimental/*',
    },
    {
      key: 'includeDrafts',
      label: 'Include draft pull requests',
      type: 'checkbox',
      when: ({ form }) => form.events.includes('pull_request'),
    },
  ],
  validate: (form) => {
    const errors = {}
    if (!form.repository) errors.repository = 'Choose a repository.'
    if (!form.events.length) errors.events = 'Select at least one event.'
    return errors
  },
}

export default githubTriggerConfig
