
const gmailTriggerConfig = {
  label: 'Gmail Trigger',
  description: 'Start a workflow when a new email or matching email arrives.',
  defaults: {
    connection: '',
    event: 'new_email',
    label: 'INBOX',
    sender: '',
    subjectContains: '',
    hasAttachments: false,
  },
  fields: [
    {
      key: 'gmailConnection',
      label: 'Gmail connection',
      type: 'integration',
      description: 'Connect your Google account through OAuth.',
    },
    {
      key: 'event',
      label: 'Trigger event',
      type: 'select',
      options: [
        { value: 'new_email', label: 'New Email Received' },
        { value: 'new_matching_email', label: 'Email Matching Filters' },
      ],
      required: true,
    },
    {
      key: 'label',
      label: 'Gmail label',
      type: 'select',
      options: [
        { value: 'INBOX', label: 'Inbox' },
        { value: 'STARRED', label: 'Starred' },
        { value: 'IMPORTANT', label: 'Important' },
      ],
    },
    {
      key: 'sender',
      label: 'From email',
      type: 'text',
      placeholder: 'example@gmail.com',
      when: ({ form }) => form.event === 'new_matching_email',
    },
    {
      key: 'subjectContains',
      label: 'Subject contains',
      type: 'text',
      placeholder: 'Invoice, meeting...',
      when: ({ form }) => form.event === 'new_matching_email',
    },
    {
      key: 'hasAttachments',
      label: 'Only emails with attachments',
      type: 'checkbox',
    },
  ],

  validate: (form) => {
    const errors = {};

    if (!form.event) {
      errors.event = 'Select a trigger event.';
    }

    if (
      form.event === 'new_matching_email' &&
      form.sender &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.sender)
    ) {
      errors.sender = 'Enter a valid email address.';
    }

    return errors;
  },
};

export default gmailTriggerConfig;
