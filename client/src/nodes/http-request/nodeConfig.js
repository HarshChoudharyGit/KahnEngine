// Methods that send a request body (used to show/hide the body field)
const httpMethodsWithBody = ['POST', 'PUT', 'PATCH']

// Returns true only for valid http/https URLs
const isHttpUrl = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

// Checks key/value rows: a row must have both key and value, or neither
const validateKeyValueRows = (rows, label) => {
  if (!Array.isArray(rows)) return {}
  const errors = {}
  rows.forEach((row, index) => {     
    if (row.key.trim() && !row.value.trim()) {
      errors[`${label}.${index}.value`] = 'Add a value or remove this row.'
    } else if (!row.key.trim() && row.value.trim()) {
      errors[`${label}.${index}.key`] = 'Add a key or remove this row.'
    }
  })
  return errors
}

const httpRequestConfig = {
  label: 'HTTP Request',
  description: 'Call an external endpoint from this workflow.',

  // Initial form values for a new node
  defaults: {
    method: 'GET',
    url: '',
    headers: [{ key: '', value: '' }],
    queryParams: [{ key: '', value: '' }],
    body: '',
    authentication: 'none',
    bearerToken: '',
    apiKeyName: 'X-API-Key',
    apiKeyValue: '',
  },

  // Fields to render in the form
  fields: [
    {
      key: 'method',
      label: 'Method',
      type: 'select',
      options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => ({ value, label: value })),
    },
    {
      key: 'url',
      label: 'Request URL',
      type: 'url',
      placeholder: 'https://api.example.com/v1/resource',
      required: true,
    },
    { key: 'headers', label: 'Headers', type: 'keyValue' },
    { key: 'queryParams', label: 'Query parameters', type: 'keyValue' },
    {
      key: 'authentication',
      label: 'Authentication',
      type: 'select',
      options: [
        { value: 'none', label: 'No authentication' },
        { value: 'bearer', label: 'Bearer token' },
        { value: 'apiKey', label: 'API key' },
      ],
    },
    // Shown only when Bearer auth is selected
    {
      key: 'bearerToken',
      label: 'Bearer token',
      type: 'password',
      required: true,
      when: ({ form }) => form.authentication === 'bearer',
    },
    // Shown only when API key auth is selected
    {
      key: 'apiKeyName',
      label: 'API key header name',
      type: 'text',
      required: true,
      when: ({ form }) => form.authentication === 'apiKey',
    },
    {
      key: 'apiKeyValue',
      label: 'API key value',
      type: 'password',
      required: true,
      when: ({ form }) => form.authentication === 'apiKey',
    },
    // Shown only for methods that send a body
    {
      key: 'body',
      label: 'Request body',
      type: 'textarea',
      placeholder: '{\n  "name": "{{trigger.body.name}}"\n}',
      rows: 6,
      when: ({ form }) => httpMethodsWithBody.includes(form.method),
    },
  ],

  // Frontend validation: returns an object of { fieldPath: errorMessage }
  validate: (form) => {
    const errors = {}

    // URL: required and must be http/https
    if (!form.url.trim()) {
      errors.url = 'Enter a request URL.'
    } else if (!isHttpUrl(form.url.trim())) {
      errors.url = 'Enter a valid HTTP or HTTPS URL.'
    }

    // Headers and query params: no half-filled rows
    Object.assign(errors, validateKeyValueRows(form.headers, 'headers'))
    Object.assign(errors, validateKeyValueRows(form.queryParams, 'queryParams'))

    // Auth: only check fields for the selected mode
    if (form.authentication === 'bearer' && !form.bearerToken.trim()) {
      errors.bearerToken = 'Enter a bearer token.'
    }
    if (form.authentication === 'apiKey') {
      if (!form.apiKeyName.trim()) errors.apiKeyName = 'Enter the API key header name.'
      if (!form.apiKeyValue.trim()) errors.apiKeyValue = 'Enter the API key value.'
    }

    return errors
  },
}

export default httpRequestConfig