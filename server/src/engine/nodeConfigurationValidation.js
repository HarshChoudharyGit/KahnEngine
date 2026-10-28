function isPresent(value) {
  return typeof value === 'string' ? Boolean(value.trim()) : value !== undefined && value !== null;
}

export function validateCronExpression(expression) {
  if (typeof expression !== 'string') return false;
  const fields = expression.trim().split(/\s+/);
  const ranges = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
  if (fields.length !== 5) return false;

  return fields.every((field, index) => {
    const [minimum, maximum] = ranges[index];
    return field.split(',').every((part) => {
      const segments = part.split('/');
      if (segments.length > 2 || (segments[1] && !/^\d+$/.test(segments[1]))) return false;
      if (segments[1] && Number(segments[1]) < 1) return false;
      const base = segments[0];
      if (base === '*') return true;
      const values = base.split('-');
      if (values.length > 2 || values.some((value) => !/^\d+$/.test(value))) return false;
      const numbers = values.map(Number);
      return numbers.every((value) => value >= minimum && value <= maximum) &&
        (numbers.length === 1 || numbers[0] <= numbers[1]);
    });
  });
}

function isHttpUrl(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.includes('{{') && trimmed.includes('}}')) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validEmail(value) {
  return typeof value === 'string' &&
    (value.includes('{{') || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function requiredValues(config, keys, errors) {
  for (const [key, label] of keys) {
    if (!isPresent(config[key])) errors.push(`${label} is required.`);
  }
}

function validateKeyValueRows(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be a list of key/value pairs.`);
    return;
  }
  value.forEach((row, index) => {
    const key = String(row?.key ?? '').trim();
    const entryValue = String(row?.value ?? '').trim();
    if (Boolean(key) !== Boolean(entryValue)) {
      errors.push(`${label} row ${index + 1} needs both a key and a value, or neither.`);
    }
  });
}

export function validateNodeConfigurations(nodes = []) {
  return nodes.flatMap((node) => {
    const data = node.data || {};
    const config = data.configuration || data;
    const type = String(data.configType || data.type || node.type || '').toLowerCase();
    const errors = [];
    if (data.configurationStatus !== 'configured') {
      errors.push('Save this node’s configuration before running the workflow.');
    }
    const required = (key, label = key) => {
      if (!isPresent(config[key])) errors.push(`${label} is required.`);
    };

    switch (type) {
      case 'github':
      case 'githubtrigger': {
        const repo = String(config.repository || '');
        if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) errors.push('Choose a repository in owner/repository format.');
        const events = config.events ?? ['push'];
        if (!Array.isArray(events) || events.length === 0) errors.push('Select at least one GitHub event.');
        else if (events.some((event) => !['push', 'pull_request', 'issues', 'release'].includes(event))) {
          errors.push('Select only supported GitHub events.');
        }
        break;
      }
      case 'gmail':
      case 'gmailaction': {
        const operation = config.operation || 'send_email';
        if (!['send_email', 'reply_email', 'search_emails', 'add_label'].includes(operation)) {
          errors.push('Select a supported Gmail operation.');
        } else if (operation === 'send_email') {
          required('to', 'Recipient email');
          if (config.to && !validEmail(config.to)) errors.push('Enter a valid recipient email.');
          required('subject', 'Email subject');
          required('body', 'Email body');
        } else if (operation === 'reply_email' || operation === 'add_label') {
          required('messageId', 'Message ID');
          if (operation === 'reply_email') required('body', 'Email body');
          if (operation === 'add_label' && config.labelName &&
            !['STARRED', 'IMPORTANT', 'UNREAD'].includes(config.labelName)) {
            errors.push('Choose a supported Gmail label.');
          }
        } else {
          required('searchQuery', 'Search query');
        }
        break;
      }
      case 'gmailtrigger': {
        const event = config.event || 'new_email';
        if (!['new_email', 'new_matching_email'].includes(event)) errors.push('Select a supported Gmail trigger event.');
        if (event === 'new_matching_email' && config.sender &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.sender)) {
          errors.push('Enter a valid sender email.');
        }
        break;
      }
      case 'http':
      case 'httprequest':
      case 'http-request': {
        if (!isHttpUrl(String(config.url || ''))) errors.push('Enter a valid HTTP or HTTPS request URL.');
        const method = String(config.method || 'GET').toUpperCase();
        if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(method)) errors.push('Choose a supported HTTP method.');
        validateKeyValueRows(config.headers ?? [], 'Headers', errors);
        validateKeyValueRows(config.queryParams ?? [], 'Query parameters', errors);
        if (config.responsePath && !/^[\w.[\]-]+$/.test(String(config.responsePath).trim())) {
          errors.push('Use a dotted HTTP response path such as data.jobs.');
        }
        if (config.mockMode) {
          try {
            const mockResponse = JSON.parse(config.mockResponse || '');
            if (!mockResponse || typeof mockResponse !== 'object') {
              errors.push('HTTP sample response must be a JSON object or array.');
            }
          } catch {
            errors.push('Enter valid JSON for the HTTP sample response.');
          }
        }
        const authentication = config.authentication || 'none';
        if (authentication === 'bearer' && !isPresent(config.bearerToken)) errors.push('Bearer token is required.');
        else if (authentication === 'apiKey') {
          required('apiKeyName', 'API key header name');
          required('apiKeyValue', 'API key value');
        } else if (authentication === 'basic') {
          required('basicUsername', 'Username');
        } else if (!['none', 'bearer', 'apiKey', 'basic'].includes(authentication)) {
          errors.push('Choose a supported authentication method.');
        }
        break;
      }
      case 'webhook':
      case 'webhooktrigger': {
        const path = String(config.path || '');
        if (!path.startsWith('/') || path.length < 2) errors.push('Webhook path must start with / and include a path name.');
        const method = String(config.method || 'POST').toUpperCase();
        if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) errors.push('Choose a supported HTTP method.');
        if (config.authentication === 'bearer' && !isPresent(config.secret)) errors.push('Webhook bearer secret is required.');
        if (config.authentication && !['none', 'bearer'].includes(config.authentication)) errors.push('Choose a supported authentication method.');
        break;
      }
      case 'javascript':
      case 'transform': {
        required('code', 'JavaScript code');
        if (isPresent(config.code)) {
          try {
            new Function('trigger', 'context', 'outputs', config.code);
          } catch (error) {
            errors.push(`JavaScript has a syntax error: ${error.message}`);
          }
        }
        break;
      }
      case 'wait':
      case 'delay': {
        const duration = Number(config.duration ?? config.durationMs);
        if (!Number.isFinite(duration) || duration <= 0) errors.push('Delay duration must be a positive number.');
        if (config.unit && !['seconds', 'minutes', 'hours', 'days'].includes(config.unit)) {
          errors.push('Choose a supported delay unit.');
        }
        break;
      }
      case 'cron':
      case 'crontrigger': {
        if (!validateCronExpression(config.schedule)) errors.push('Enter a valid five-field cron expression.');
        const timezone = config.timezone || 'UTC';
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: timezone });
        } catch {
          errors.push('Enter a valid time zone.');
        }
        break;
      }
      case 'aiagent':
      case 'ai-agent': {
        required('systemInstructions', 'System instructions');
        required('prompt', 'Agent prompt');
        const supportedAiModels = [
          'gemini-3.5-flash',
          'gemini-3.5-flash-lite',
          'gemini-3.8-flash',
          'gemini-2.0-flash',
          'gemini-1.5-flash',
          'gemini-1.5-pro',
          'gpt-4o-mini',
          'gpt-4o',
          'gpt-3.5-turbo',
          'claude-3-5-sonnet',
        ];
        if (config.model && !supportedAiModels.includes(config.model)) {
          errors.push('Choose a supported AI model.');
        }
        if (config.temperature !== undefined &&
          (!Number.isFinite(Number(config.temperature)) || Number(config.temperature) < 0 || Number(config.temperature) > 2)) {
          errors.push('Temperature must be between 0 and 2.');
        }
        if (config.maxOutputTokens !== undefined &&
          (!Number.isInteger(Number(config.maxOutputTokens)) || Number(config.maxOutputTokens) < 1 || Number(config.maxOutputTokens) > 128000)) {
          errors.push('Maximum output tokens must be a whole number from 1 to 128,000.');
        }
        if (config.structuredOutput) {
          try {
            JSON.parse(config.outputSchema);
          } catch {
            errors.push('Structured output requires a valid JSON schema.');
          }
        }
        break;
      }
      case 'condition': {
        required('leftValue', 'Value to evaluate');
        const supportedOperators = ['equals', 'notEquals', 'contains', 'greaterThan', 'lessThan', 'isEmpty'];
        const operator = config.operator || 'equals';
        if (!supportedOperators.includes(operator)) {
          errors.push('Choose a supported condition operator.');
        }
        if (operator !== 'isEmpty') {
          required('rightValue', 'Comparison value');
        }
        if (['greaterThan', 'lessThan'].includes(operator)) {
          const isExpression = (value) => typeof value === 'string' &&
            /^\s*\{\{[\w.[\]-]+\}\}\s*$/.test(value);
          const isNumeric = (value) => typeof value === 'number' ||
            (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)));
          if (
            (!isExpression(config.leftValue) && !isNumeric(config.leftValue)) ||
            (!isExpression(config.rightValue) && !isNumeric(config.rightValue))
          ) {
            errors.push('Both values must be numbers for greater-than or less-than conditions.');
          }
        }
        break;
      }
      case 'loop': {
        const mode = config.mode || 'forEach';
        const maxIterations = Number(config.maxIterations ?? 100);
        const isExpression = (value) => typeof value === 'string' &&
          /^\{\{[\w.[\]-]+\}\}$/.test(value.trim());
        if (!['forEach', 'fixed'].includes(mode)) {
          errors.push('Choose a supported loop mode.');
        }
        if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 1000) {
          errors.push('Maximum iterations must be a whole number from 1 to 1000.');
        }
        if (mode === 'forEach' && !isExpression(config.arrayExpression)) {
          errors.push('Enter an expression that resolves to an array, such as {{nodes.httpRequest1.output.data}}.');
        }
        if (mode === 'fixed') {
          const iterations = Number(config.iterations);
          if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1000) {
            errors.push('Iteration count must be a whole number from 1 to 1000.');
          } else if (Number.isInteger(maxIterations) && iterations > maxIterations) {
            errors.push('Iteration count cannot exceed the maximum iterations.');
          }
        }
        break;
      }
      case 'discord': {
        required('channelId', 'Channel ID');
        required('message', 'Message');
        break;
      }
      case 'airtop':
        if (!isHttpUrl(String(config.sessionUrl || ''))) errors.push('Enter a valid HTTP or HTTPS starting URL.');
        break;
      case 'airtable': {
        requiredValues(config, [['baseId', 'Base ID'], ['table', 'Table name']], errors);
        const operation = config.operation || 'list';
        if (['update', 'delete'].includes(operation)) required('recordId', 'Record ID');
        if (['create', 'update'].includes(operation)) {
          required('recordData', 'Record fields');
          if (isPresent(config.recordData)) {
            try {
              JSON.parse(config.recordData);
            } catch {
              errors.push('Record fields must be valid JSON.');
            }
          }
        }
        break;
      }
      case 'mailcheck':
        required('email', 'Email address');
        if (isPresent(config.email) && !validEmail(config.email)) errors.push('Enter a valid email address or template.');
        break;
      case 'mailchimp':
        requiredValues(config, [['audienceId', 'Audience'], ['email', 'Subscriber email']], errors);
        if (isPresent(config.email) && !validEmail(config.email)) errors.push('Enter a valid subscriber email or template.');
        break;
      case 'mailgun':
        requiredValues(config, [
          ['domain', 'Sending domain'], ['from', 'Sender'], ['to', 'Recipient'],
          ['subject', 'Subject'], ['text', 'Email text'],
        ], errors);
        if (isPresent(config.to) && !validEmail(config.to)) errors.push('Enter a valid recipient email or template.');
        break;
      case 'mailjet':
        requiredValues(config, [
          ['senderEmail', 'Sender email'], ['recipientEmail', 'Recipient email'],
          ['subject', 'Subject'], ['htmlBody', 'HTML message'],
        ], errors);
        for (const key of ['senderEmail', 'recipientEmail']) {
          if (isPresent(config[key]) && !validEmail(config[key])) errors.push(`Enter a valid ${key === 'senderEmail' ? 'sender' : 'recipient'} email or template.`);
        }
        break;
      case 'slack':
        requiredValues(config, [['channel', 'Channel'], ['message', 'Message']], errors);
        break;
      case 'taiga': {
        requiredValues(config, [['projectId', 'Project'], ['subject', 'Task subject']], errors);
        if ((config.operation || 'create') === 'update') required('taskId', 'Task ID');
        break;
      }
      case 'raindrop':
        if (!isHttpUrl(String(config.url || ''))) errors.push('Enter a valid HTTP or HTTPS bookmark URL.');
        required('collectionId', 'Collection');
        break;
      case 'shopify': {
        required('storeDomain', 'Store domain');
        const operation = config.operation || 'get';
        if (operation !== 'create') required('resourceId', 'Resource ID');
        if (operation !== 'get') {
          required('resourceData', 'Resource data');
          if (isPresent(config.resourceData)) {
            try {
              JSON.parse(config.resourceData);
            } catch {
              errors.push('Resource data must be valid JSON.');
            }
          }
        }
        break;
      }
      case 'supportdesk': {
        requiredValues(config, [
          ['requesterEmail', 'Requester email'], ['subject', 'Subject'], ['description', 'Description'],
        ], errors);
        if (isPresent(config.requesterEmail) && !validEmail(config.requesterEmail)) errors.push('Enter a valid requester email or template.');
        if ((config.operation || 'create') === 'update') required('ticketId', 'Ticket ID');
        break;
      }
      case 'database': {
        requiredValues(config, [['connectionName', 'Saved connection name'], ['table', 'Table']], errors);
        const operation = config.operation || 'select';
        if (['insert', 'update'].includes(operation)) {
          required('values', 'Values');
          if (isPresent(config.values)) {
            try {
              JSON.parse(config.values);
            } catch {
              errors.push('Values must be valid JSON.');
            }
          }
        }
        break;
      }
      default:
        if (!data.configType && !isPresent(data.title)) errors.push('Node name is required.');
        break;
    }

    return errors.length
      ? [{ nodeId: node.id, nodeTitle: data.title || node.id, messages: errors }]
      : [];
  });
}
