import { Plus, Trash2 } from 'lucide-react'

const inputClassName = 'mt-1.5 w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-3 py-2.5 text-sm text-[#f0e5c9] outline-none transition placeholder:text-[#756b5a] focus:border-[#c69b45]'
const methodsWithBody = ['POST', 'PUT', 'PATCH']

// Form component for configuring HTTP request parameters, headers, query params, and body
function HttpRequestConfigForm({ value, errors, onChange }) {
  // Updates a single field in the HTTP request configuration
  const setField = (key, nextValue) => onChange({ ...value, [key]: nextValue })

  // Renders editable key-value input rows for headers and query parameters
  const renderKeyValueRows = (field, label) => (
    <div>
      <p className="mb-2 text-xs font-medium text-[#c9b991]">{label}</p>
      <div className="space-y-2">
        {(value[field] ?? []).map((row, index) => (
          <div key={`${field}-${index}`} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <input
                aria-label={`${label} key ${index + 1}`}
                value={row.key}
                onChange={(event) => setField(
                  field,
                  value[field].map((item, rowIndex) => (
                    rowIndex === index ? { ...item, key: event.target.value } : item
                  )),
                )}
                placeholder="Key"
                className="w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-2.5 py-2 text-xs text-[#f0e5c9] outline-none placeholder:text-[#756b5a] focus:border-[#c69b45]"
              />
              {errors[`${field}.${index}.key`] && <p role="alert" className="mt-1 text-[11px] text-[#e18a7a]">{errors[`${field}.${index}.key`]}</p>}
            </div>
            <div className="min-w-0 flex-1">
              <input
                aria-label={`${label} value ${index + 1}`}
                value={row.value}
                onChange={(event) => setField(
                  field,
                  value[field].map((item, rowIndex) => (
                    rowIndex === index ? { ...item, value: event.target.value } : item
                  )),
                )}
                placeholder="Value"
                className="w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-2.5 py-2 text-xs text-[#f0e5c9] outline-none placeholder:text-[#756b5a] focus:border-[#c69b45]"
              />
              {errors[`${field}.${index}.value`] && <p role="alert" className="mt-1 text-[11px] text-[#e18a7a]">{errors[`${field}.${index}.value`]}</p>}
            </div>
            <button
              type="button"
              aria-label={`Remove ${label.toLowerCase()} row ${index + 1}`}
              onClick={() => setField(field, value[field].filter((_, rowIndex) => rowIndex !== index))}
              className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#a9997b] transition hover:bg-[#8f4d3b]/15 hover:text-[#e18a7a]"
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setField(field, [...value[field], { key: '', value: '' }])}
        className="mt-2 inline-flex items-center gap-1.5 rounded px-1 py-1 text-xs text-[#d4ad58] transition hover:text-[#f0d58e]"
      >
        <Plus aria-hidden="true" className="h-3.5 w-3.5" />
        Add {label.toLowerCase().replace(/s$/, '')}
      </button>
    </div>
  )

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="http-method" className="block text-xs font-medium text-[#c9b991]">Method</label>
        <select
          id="http-method"
          value={value.method}
          onChange={(event) => setField('method', event.target.value)}
          className={inputClassName}
        >
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => <option key={method}>{method}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="http-url" className="block text-xs font-medium text-[#c9b991]">
          Request URL<span className="ml-1 text-[#d98a74]">*</span>
        </label>
        <input
          id="http-url"
          type="url"
          value={value.url}
          onChange={(event) => setField('url', event.target.value)}
          placeholder="https://api.example.com/v1/resource"
          aria-invalid={Boolean(errors.url)}
          className={inputClassName}
        />
        {errors.url && <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.url}</p>}
      </div>

      {renderKeyValueRows('headers', 'Headers')}
      {renderKeyValueRows('queryParams', 'Query parameters')}

      <div>
        <label htmlFor="http-authentication" className="block text-xs font-medium text-[#c9b991]">Authentication</label>
        <select
          id="http-authentication"
          value={value.authentication}
          onChange={(event) => setField('authentication', event.target.value)}
          className={inputClassName}
        >
          <option value="none">No authentication</option>
          <option value="bearer">Bearer token</option>
          <option value="apiKey">API key</option>
        </select>
      </div>

      {value.authentication === 'bearer' && (
        <div>
          <label htmlFor="http-bearer-token" className="block text-xs font-medium text-[#c9b991]">
            Bearer token<span className="ml-1 text-[#d98a74]">*</span>
          </label>
          <input
            id="http-bearer-token"
            type="password"
            autoComplete="new-password"
            value={value.bearerToken}
            onChange={(event) => setField('bearerToken', event.target.value)}
            aria-invalid={Boolean(errors.bearerToken)}
            className={inputClassName}
          />
          {errors.bearerToken && <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.bearerToken}</p>}
        </div>
      )}

      {value.authentication === 'apiKey' && (
        <>
          <div>
            <label htmlFor="http-api-key-name" className="block text-xs font-medium text-[#c9b991]">
              API key header name<span className="ml-1 text-[#d98a7a]">*</span>
            </label>
            <input
              id="http-api-key-name"
              value={value.apiKeyName}
              onChange={(event) => setField('apiKeyName', event.target.value)}
              aria-invalid={Boolean(errors.apiKeyName)}
              className={inputClassName}
            />
            {errors.apiKeyName && <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.apiKeyName}</p>}
          </div>
          <div>
            <label htmlFor="http-api-key-value" className="block text-xs font-medium text-[#c9b991]">
              API key value<span className="ml-1 text-[#d98a7a]">*</span>
            </label>
            <input
              id="http-api-key-value"
              type="password"
              autoComplete="new-password"
              value={value.apiKeyValue}
              onChange={(event) => setField('apiKeyValue', event.target.value)}
              aria-invalid={Boolean(errors.apiKeyValue)}
              className={inputClassName}
            />
            {errors.apiKeyValue && <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.apiKeyValue}</p>}
          </div>
        </>
      )}

      {methodsWithBody.includes(value.method) && (
        <div>
          <label htmlFor="http-body" className="block text-xs font-medium text-[#c9b991]">Request body</label>
          <textarea
            id="http-body"
            value={value.body}
            onChange={(event) => setField('body', event.target.value)}
            rows={6}
            placeholder={'{\n  "name": "{{trigger.body.name}}"\n}'}
            className={inputClassName}
          />
        </div>
      )}
    </div>
  )
}

export default HttpRequestConfigForm
