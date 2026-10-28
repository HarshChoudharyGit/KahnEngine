const simpleRequiredConfig = (label, description, fields, requiredKeys) => ({
  label,
  description,
  defaults: {},
  fields,
  validate: (form) => {
    const requiredFields = fields.filter((field) =>
      requiredKeys.includes(field.key) && (!field.when || field.when({ form })),
    )
    return Object.fromEntries(
      requiredFields
        .filter((field) => !String(form[field.key] ?? '').trim())
        .map((field) => [field.key, `${field.label} is required.`]),
    )
  },
})

const connectorConfig = (label, description, fields, defaults = {}) => ({
  label,
  description,
  defaults,
  fields: [
    {
      key: 'connection',
      label: `${label} connection`,
      type: 'integration',
      integrationName: label,
      description: `Connect ${label} through your workspace integration settings.`,
    },
    ...fields,
  ],
  validate: (form) => {
    const requiredFields = fields.filter((field) => field.required && (!field.when || field.when({ form })))
    return Object.fromEntries(
      requiredFields
        .filter((field) => !String(form[field.key] ?? '').trim())
        .map((field) => [field.key, `${field.label} is required.`]),
    )
  },
})

const builtInNodeConfigs = {
  webhookTrigger: simpleRequiredConfig(
    'Webhook Trigger',
    'Receive an HTTP request to start this workflow.',
    [
      { key: 'method', label: 'HTTP method', type: 'select', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => ({ value, label: value })) },
      { key: 'path', label: 'Webhook path', type: 'text', placeholder: '/v1/customers/lead', required: true },
      { key: 'authentication', label: 'Authentication', type: 'select', options: [{ value: 'none', label: 'None' }, { value: 'bearer', label: 'Bearer token' }] },
      { key: 'secret', label: 'Bearer token', type: 'password', when: ({ form }) => form.authentication === 'bearer', required: true },
    ],
    ['path', 'secret'],
  ),
  javascript: simpleRequiredConfig(
    'Transform',
    'Transform incoming workflow data with JavaScript.',
    [
      { key: 'code', label: 'JavaScript code', type: 'textarea', rows: 10, placeholder: 'return { ...input, normalized: true }', required: true },
      { key: 'input', label: 'Input template', type: 'textarea', rows: 3, placeholder: '{{trigger.body}}' },
    ],
    ['code'],
  ),
  wait: simpleRequiredConfig(
    'Delay',
    'Pause workflow execution before continuing.',
    [
      { key: 'duration', label: 'Duration', type: 'number', min: 1, step: 1, required: true },
      { key: 'unit', label: 'Time unit', type: 'select', options: [{ value: 'seconds', label: 'Seconds' }, { value: 'minutes', label: 'Minutes' }, { value: 'hours', label: 'Hours' }, { value: 'days', label: 'Days' }] },
    ],
    ['duration'],
  ),
  cronTrigger: simpleRequiredConfig(
    'Cron Trigger',
    'Start a workflow on a recurring schedule.',
    [
      { key: 'schedule', label: 'Cron expression', type: 'text', placeholder: '0 9 * * 1-5', required: true },
      { key: 'timezone', label: 'Time zone', type: 'text', placeholder: 'UTC' },
    ],
    ['schedule'],
  ),
  airtop: connectorConfig('Airtop', 'Automate a browser session.', [
    { key: 'sessionUrl', label: 'Starting URL', type: 'url', placeholder: 'https://example.com', required: true },
    { key: 'action', label: 'Browser action', type: 'select', options: [{ value: 'navigate', label: 'Navigate' }, { value: 'extract', label: 'Extract page content' }, { value: 'screenshot', label: 'Take screenshot' }] },
    { key: 'instructions', label: 'Instructions', type: 'textarea', rows: 3, placeholder: 'Describe what the browser should do...' },
  ]),
  airtable: connectorConfig('Airtable', 'Read or update records in an Airtable base.', [
    { key: 'operation', label: 'Operation', type: 'select', options: [{ value: 'list', label: 'List records' }, { value: 'create', label: 'Create record' }, { value: 'update', label: 'Update record' }, { value: 'delete', label: 'Delete record' }] },
    { key: 'baseId', label: 'Base ID', type: 'text', required: true },
    { key: 'table', label: 'Table name', type: 'text', required: true },
    { key: 'recordId', label: 'Record ID', type: 'text', when: ({ form }) => ['update', 'delete'].includes(form.operation) },
    { key: 'recordData', label: 'Record fields (JSON)', type: 'textarea', rows: 4, placeholder: '{"Name":"Example"}', when: ({ form }) => ['create', 'update'].includes(form.operation) },
  ]),
  mailcheck: simpleRequiredConfig(
    'Mailcheck',
    'Validate an email address before using it in downstream steps.',
    [
      { key: 'email', label: 'Email to validate', type: 'text', placeholder: '{{trigger.body.email}}', required: true },
      { key: 'checkTypo', label: 'Check for domain typos', type: 'checkbox' },
      { key: 'checkDisposable', label: 'Reject disposable email domains', type: 'checkbox' },
    ],
    ['email'],
  ),
  mailchimp: connectorConfig('Mailchimp', 'Manage subscribers in a Mailchimp audience.', [
    { key: 'operation', label: 'Operation', type: 'select', options: [{ value: 'add', label: 'Add or update subscriber' }, { value: 'unsubscribe', label: 'Unsubscribe' }] },
    { key: 'audienceId', label: 'Audience', type: 'text', required: true },
    { key: 'email', label: 'Subscriber email', type: 'text', placeholder: '{{trigger.body.email}}', required: true },
    { key: 'status', label: 'Subscriber status', type: 'select', options: [{ value: 'subscribed', label: 'Subscribed' }, { value: 'pending', label: 'Pending' }] },
    { key: 'mergeFields', label: 'Merge fields (JSON)', type: 'textarea', rows: 3, placeholder: '{"FNAME":"Ada"}' },
  ], { operation: 'add', status: 'subscribed' }),
  mailgun: connectorConfig('Mailgun', 'Send transactional email with Mailgun.', [
    { key: 'domain', label: 'Sending domain', type: 'text', placeholder: 'mg.example.com', required: true },
    { key: 'from', label: 'From', type: 'text', placeholder: 'Team <team@example.com>', required: true },
    { key: 'to', label: 'To', type: 'text', placeholder: 'person@example.com', required: true },
    { key: 'subject', label: 'Subject', type: 'text', required: true },
    { key: 'text', label: 'Email text', type: 'textarea', rows: 4, required: true },
  ]),
  mailjet: connectorConfig('Mailjet', 'Send an email using a Mailjet sender identity.', [
    { key: 'senderEmail', label: 'Sender email', type: 'text', placeholder: 'team@example.com', required: true },
    { key: 'recipientEmail', label: 'Recipient email', type: 'text', placeholder: '{{trigger.body.email}}', required: true },
    { key: 'subject', label: 'Subject', type: 'text', required: true },
    { key: 'htmlBody', label: 'HTML message', type: 'textarea', rows: 5, required: true },
  ]),
  discord: connectorConfig('Discord', 'Post a message to a Discord channel.', [
    { key: 'channelId', label: 'Channel ID', type: 'text', required: true },
    { key: 'message', label: 'Message', type: 'textarea', rows: 5, placeholder: 'A workflow event occurred: {{trigger.body}}', required: true },
    { key: 'threadName', label: 'Thread name (optional)', type: 'text' },
  ]),
  slack: connectorConfig('Slack', 'Send a message to a Slack conversation.', [
    { key: 'channel', label: 'Channel', type: 'text', placeholder: '#announcements', required: true },
    { key: 'message', label: 'Message text', type: 'textarea', rows: 5, placeholder: 'A workflow event occurred: {{trigger.body}}', required: true },
    { key: 'replyToThread', label: 'Reply to thread timestamp', type: 'text' },
  ]),
  taiga: connectorConfig('Taiga', 'Create or update a Taiga project task.', [
    { key: 'projectId', label: 'Project', type: 'text', required: true },
    { key: 'operation', label: 'Operation', type: 'select', options: [{ value: 'create', label: 'Create user story' }, { value: 'update', label: 'Update user story' }] },
    { key: 'subject', label: 'Task subject', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea', rows: 4 },
    { key: 'taskId', label: 'Task ID', type: 'text', required: true, when: ({ form }) => form.operation === 'update' },
  ], { operation: 'create' }),
  raindrop: connectorConfig('Raindrop', 'Save a bookmark to a Raindrop collection.', [
    { key: 'url', label: 'Bookmark URL', type: 'url', placeholder: '{{trigger.body.url}}', required: true },
    { key: 'collectionId', label: 'Collection', type: 'text', placeholder: '0 for unsorted', required: true },
    { key: 'tags', label: 'Tags', type: 'text', placeholder: 'workflow, saved' },
    { key: 'note', label: 'Note', type: 'textarea', rows: 3 },
  ]),
  shopify: connectorConfig('Shopify', 'Read or update Shopify store resources.', [
    { key: 'storeDomain', label: 'Store domain', type: 'text', placeholder: 'your-store.myshopify.com', required: true },
    { key: 'resource', label: 'Resource', type: 'select', options: [{ value: 'products', label: 'Products' }, { value: 'orders', label: 'Orders' }, { value: 'customers', label: 'Customers' }] },
    { key: 'operation', label: 'Operation', type: 'select', options: [{ value: 'get', label: 'Get' }, { value: 'create', label: 'Create' }, { value: 'update', label: 'Update' }] },
    { key: 'resourceId', label: 'Resource ID', type: 'text', required: true, when: ({ form }) => form.operation !== 'create' },
    { key: 'resourceData', label: 'Data (JSON)', type: 'textarea', rows: 4, required: true, when: ({ form }) => form.operation !== 'get' },
  ], { resource: 'products', operation: 'get' }),
  supportDesk: connectorConfig('Support Desk', 'Create or update a support ticket.', [
    { key: 'operation', label: 'Operation', type: 'select', options: [{ value: 'create', label: 'Create ticket' }, { value: 'update', label: 'Update ticket' }] },
    { key: 'ticketId', label: 'Ticket ID', type: 'text', required: true, when: ({ form }) => form.operation === 'update' },
    { key: 'requesterEmail', label: 'Requester email', type: 'text', placeholder: '{{trigger.body.email}}', required: true },
    { key: 'subject', label: 'Subject', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea', rows: 4, required: true },
    { key: 'priority', label: 'Priority', type: 'select', options: [{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }] },
  ], { operation: 'create', priority: 'normal' }),
  database: simpleRequiredConfig(
    'Database',
    'Read or write records in a configured database connection.',
    [
      { key: 'connectionName', label: 'Saved connection name', type: 'text', placeholder: 'Production database', required: true },
      { key: 'operation', label: 'Operation', type: 'select', options: [{ value: 'select', label: 'Select rows' }, { value: 'insert', label: 'Insert row' }, { value: 'update', label: 'Update rows' }, { value: 'delete', label: 'Delete rows' }] },
      { key: 'table', label: 'Table', type: 'text', required: true },
      { key: 'query', label: 'Query / conditions', type: 'textarea', rows: 4, placeholder: 'status = {{trigger.body.status}}' },
      { key: 'values', label: 'Values (JSON)', type: 'textarea', rows: 4, placeholder: '{"status":"active"}', when: ({ form }) => ['insert', 'update'].includes(form.operation) },
    ],
    ['connectionName', 'table'],
  ),
}

export { builtInNodeConfigs }
