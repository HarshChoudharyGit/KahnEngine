const gmailActionConfig = {
  label: 'Gmail',
  description: 'Send, reply to, search, and manage emails.',
  defaults: {
    gmailConnection: '',
    operation: 'send_email',
    to: '',
    subject: '',
    body: '',
    messageId: '',
    searchQuery: '',
    labelName: 'STARRED',
  },
  fields: [
    {
      key: 'gmailConnection',
      label: 'Gmail connection',
      type: 'integration',
      description: 'Connect your Google account through OAuth.',
    },
    {
      key: 'operation',
      label: 'Operation',
      type: 'select',
      options: [
        { value: 'send_email', label: 'Send Email' },
        { value: 'reply_email', label: 'Reply to Email' },
        { value: 'search_emails', label: 'Search Emails' },
        { value: 'add_label', label: 'Add Label' },
      ],
      required: true,
    },
    {
      key: 'to',
      label: 'Recipient Email',
      type: 'text',
      placeholder: 'recipient@example.com',
      when: ({ form }) => form.operation === 'send_email',
      required: true,
    },
    {
      key: 'subject',
      label: 'Subject',
      type: 'text',
      placeholder: 'Email subject',
      when: ({ form }) => form.operation === 'send_email',
      required: true,
    },
    {
      key: 'body',
      label: 'Email Body',
      type: 'textarea',
      placeholder: 'Write your email...',
      when: ({ form }) =>
        ['send_email', 'reply_email'].includes(form.operation),
      required: true,
    },
    {
      key: 'messageId',
      label: 'Message ID',
      type: 'text',
      placeholder: 'Previous node message ID',
      description: 'Use a message ID from an upstream node.',
      when: ({ form }) => ['reply_email', 'add_label'].includes(form.operation),
      required: true,
    },
    {
      key: 'searchQuery',
      label: 'Search Query',
      type: 'text',
      placeholder: 'from:example@gmail.com is:unread',
      when: ({ form }) => form.operation === 'search_emails',
      required: true,
    },
    {
      key: 'labelName',
      label: 'Label',
      type: 'select',
      options: [
        { value: 'STARRED', label: 'Starred' },
        { value: 'IMPORTANT', label: 'Important' },
        { value: 'UNREAD', label: 'Unread' },
      ],
      when: ({ form }) => form.operation === 'add_label',
      required: true,
    },
  ],

  validate: (form) => {
    const errors = {};

    if (!form.operation) {
      errors.operation = 'Select an operation.';
    }

    const toVal = String(form.to || '').trim();
    if (
      form.operation === 'send_email' &&
      (!toVal || (!toVal.includes('{{') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toVal)))
    ) {
      errors.to = 'Enter a valid recipient email or expression like {{outputs.<nodeId>.data.email}}.';
    }

    if (
      form.operation === 'send_email' &&
      !form.subject?.trim()
    ) {
      errors.subject = 'Enter an email subject.';
    }

    if (
      ['send_email', 'reply_email'].includes(form.operation) &&
      !form.body?.trim()
    ) {
      errors.body = 'Enter the email body.';
    }

    if (
      ['reply_email', 'add_label'].includes(form.operation) &&
      !form.messageId?.trim()
    ) {
      errors.messageId = 'A message ID is required.';
    }

    if (
      form.operation === 'search_emails' &&
      !form.searchQuery?.trim()
    ) {
      errors.searchQuery = 'Enter a search query.';
    }

    return errors;
  },
};

export default gmailActionConfig;
