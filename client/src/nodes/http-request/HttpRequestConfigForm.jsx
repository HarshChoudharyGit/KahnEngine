import { useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Layers,
  Loader2,
  Play,
  Plus,
  Send,
  Sliders,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const METHODS_WITH_BODY = ['POST', 'PUT', 'PATCH', 'DELETE']

const METHOD_STYLES = {
  GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  POST: 'bg-amber-500/15 text-[#f0d58e] border-amber-500/30',
  PUT: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  PATCH: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  DELETE: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  HEAD: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  OPTIONS: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

const COMMON_HEADERS = [
  { key: 'Content-Type', value: 'application/json' },
  { key: 'Accept', value: 'application/json' },
  { key: 'User-Agent', value: 'KahnEngine/1.0' },
  { key: 'Cache-Control', value: 'no-cache' },
]

const VARIABLE_TEMPLATES = [
  '{{trigger.body}}',
  '{{trigger.body.id}}',
  '{{trigger.body.url}}',
  '{{trigger.headers.authorization}}',
]

export default function HttpRequestConfigForm({ value = {}, errors = {}, onChange }) {
  const [activeTab, setActiveTab] = useState('params')
  const [showBearerToken, setShowBearerToken] = useState(false)
  const [showApiKeyValue, setShowApiKeyValue] = useState(false)
  const [showBasicPassword, setShowBasicPassword] = useState(false)
  const [copiedResponse, setCopiedResponse] = useState(false)

  // Live Test State
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [testError, setTestError] = useState(null)

  const currentMethod = (value.method || 'GET').toUpperCase()
  const currentUrl = value.url ?? ''
  const currentAuth = value.authentication || 'none'
  const currentHeaders = Array.isArray(value.headers) ? value.headers : []
  const currentQueryParams = Array.isArray(value.queryParams) ? value.queryParams : []
  const currentBody = value.body ?? ''

  const setField = (key, nextValue) => {
    onChange({ ...value, [key]: nextValue })
  }

  // Count active query params & headers
  const validParamsCount = currentQueryParams.filter((q) => q.key?.trim() || q.value?.trim()).length
  const validHeadersCount = currentHeaders.filter((h) => h.key?.trim() || h.value?.trim()).length

  // Check JSON body validity
  const jsonStatus = useMemo(() => {
    if (!currentBody.trim()) return null
    try {
      JSON.parse(currentBody)
      return { valid: true, message: 'Valid JSON format' }
    } catch (e) {
      return { valid: false, message: e.message }
    }
  }, [currentBody])

  const formatJsonBody = () => {
    if (!currentBody.trim()) return
    try {
      const parsed = JSON.parse(currentBody)
      setField('body', JSON.stringify(parsed, null, 2))
    } catch {
      // Cannot format invalid JSON
    }
  }

  const insertVariable = (targetField, variable) => {
    if (targetField === 'url') {
      setField('url', currentUrl ? `${currentUrl}${variable}` : variable)
    } else if (targetField === 'body') {
      setField('body', currentBody ? `${currentBody}\n${variable}` : variable)
    }
  }

  const renderKeyValueRows = (field, label, rows, placeholderKey = 'Key', placeholderVal = 'Value') => {
    const updateRow = (index, keyName, text) => {
      const next = rows.map((r, i) => (i === index ? { ...r, [keyName]: text } : r))
      setField(field, next)
    }

    const removeRow = (index) => {
      const next = rows.filter((_, i) => i !== index)
      setField(field, next)
    }

    const addRow = (key = '', val = '') => {
      setField(field, [...rows, { key, value: val }])
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#c9b991]">
            {label} ({rows.length})
          </span>
          {field === 'headers' && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#756b5a]">Presets:</span>
              <button
                type="button"
                onClick={() => addRow('Content-Type', 'application/json')}
                className="rounded border border-[#8e7139]/30 px-1.5 py-0.5 text-[10px] text-[#d4ad58] hover:border-[#c69b45]"
              >
                + JSON Header
              </button>
            </div>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-[#8e7139]/30 p-3 text-center text-xs text-[#756b5a]">
            No {label.toLowerCase()} added yet.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row, index) => {
              const rowKey = row.key ?? ''
              const rowVal = row.value ?? ''
              const keyError = errors[`${field}.${index}.key`]
              const valError = errors[`${field}.${index}.value`]

              return (
                <div key={`${field}-${index}`} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <input
                      aria-label={`${label} key ${index + 1}`}
                      value={rowKey}
                      onChange={(e) => updateRow(index, 'key', e.target.value)}
                      placeholder={placeholderKey}
                      className="w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-2.5 py-2 text-xs font-mono text-[#f0e5c9] outline-none placeholder:text-[#756b5a] focus:border-[#c69b45]"
                    />
                    {keyError && <p role="alert" className="mt-1 text-[11px] text-[#e18a7a]">{keyError}</p>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <input
                      aria-label={`${label} value ${index + 1}`}
                      value={rowVal}
                      onChange={(e) => updateRow(index, 'value', e.target.value)}
                      placeholder={placeholderVal}
                      className="w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-2.5 py-2 text-xs font-mono text-[#f0e5c9] outline-none placeholder:text-[#756b5a] focus:border-[#c69b45]"
                    />
                    {valError && <p role="alert" className="mt-1 text-[11px] text-[#e18a7a]">{valError}</p>}
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${label.toLowerCase()} row ${index + 1}`}
                    onClick={() => removeRow(index)}
                    className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#a9997b] transition hover:bg-[#8f4d3b]/15 hover:text-[#e18a7a]"
                  >
                    <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => addRow()}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-[#d4ad58] transition hover:bg-[#d4ad58]/10 hover:text-[#f0d58e]"
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
          Add row
        </button>
      </div>
    )
  }

  // Handle live test execution
  const runTestRequest = async () => {
    if (!currentUrl.trim()) {
      setTestError('Please enter a Request URL to test.')
      return
    }

    setIsTesting(true)
    setTestResult(null)
    setTestError(null)

    const startTime = performance.now()

    try {
      // Build effective URL with query parameters
      let fullUrl = currentUrl.trim()
      if (currentQueryParams.length > 0) {
        const params = new URLSearchParams()
        for (const q of currentQueryParams) {
          if (q.key?.trim()) params.append(q.key.trim(), q.value || '')
        }
        const qs = params.toString()
        if (qs) {
          fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs
        }
      }

      // Build headers
      const requestHeaders = { Accept: 'application/json' }
      for (const h of currentHeaders) {
        if (h.key?.trim()) requestHeaders[h.key.trim()] = h.value || ''
      }

      if (currentAuth === 'bearer' && value.bearerToken) {
        requestHeaders.Authorization = `Bearer ${value.bearerToken}`
      } else if (currentAuth === 'apiKey' && value.apiKeyName && value.apiKeyValue) {
        requestHeaders[value.apiKeyName] = value.apiKeyValue
      } else if (currentAuth === 'basic' && (value.basicUsername || value.basicPassword)) {
        const credentials = btoa(`${value.basicUsername || ''}:${value.basicPassword || ''}`)
        requestHeaders.Authorization = `Basic ${credentials}`
      }

      let body = undefined
      if (METHODS_WITH_BODY.includes(currentMethod) && currentBody.trim()) {
        requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/json'
        body = currentBody
      }

      // Try via backend test proxy first to avoid browser CORS restrictions
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
      let executed = false

      try {
        const proxyRes = await fetch(`${apiUrl}/api/v1/test-http`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: fullUrl,
            method: currentMethod,
            headers: requestHeaders,
            body,
          }),
        })

        if (proxyRes.ok) {
          const proxyData = await proxyRes.json()
          setTestResult({
            status: proxyData.status,
            statusText: proxyData.statusText,
            durationMs: proxyData.durationMs,
            headers: proxyData.headers || {},
            data: proxyData.data,
          })
          executed = true
        } else if (proxyRes.status === 502) {
          const errData = await proxyRes.json()
          setTestError({
            message: errData.error || 'Request failed on server gateway.',
            durationMs: errData.durationMs || Math.round(performance.now() - startTime),
          })
          executed = true
        }
      } catch {
        // Fall back to direct browser fetch
      }

      if (!executed) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)

        const response = await fetch(fullUrl, {
          method: currentMethod,
          headers: requestHeaders,
          body,
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        const durationMs = Math.round(performance.now() - startTime)
        const text = await response.text()
        let parsed = null
        try {
          parsed = JSON.parse(text)
        } catch {
          parsed = text
        }

        setTestResult({
          status: response.status,
          statusText: response.statusText,
          durationMs,
          headers: Object.fromEntries(response.headers.entries()),
          data: parsed,
        })
      }
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime)
      setTestError({
        message: err.name === 'AbortError' ? 'Request timed out after 8 seconds.' : err.message,
        durationMs,
      })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* 1. UNIFIED HTTP CONFIGURATION BAR (Method + URL) */}
      <div className="rounded-lg border border-[#8e7139]/40 bg-[#14100c] p-3 shadow-inner">
        <label htmlFor="http-url-bar" className="mb-2 flex items-center justify-between text-xs font-semibold text-[#c9b991]">
          <span>HTTP Request Endpoint</span>
          <span className="text-[10px] font-normal text-[#81745f]">REST / Webhook / API</span>
        </label>

        <div className="flex items-center gap-1.5">
          {/* Method Selector with Dynamic Badges */}
          <div className="relative shrink-0">
            <select
              id="http-method-select"
              aria-label="HTTP Method"
              value={currentMethod}
              onChange={(e) => setField('method', e.target.value)}
              className={`h-9 cursor-pointer appearance-none rounded-md border pl-2.5 pr-7 text-xs font-bold tracking-wider outline-none transition focus:ring-1 focus:ring-[#c69b45] ${METHOD_STYLES[currentMethod] || 'bg-[#1b1510] text-[#f0e5c9] border-[#8e7139]/40'
                }`}
            >
              {METHODS.map((m) => (
                <option key={m} value={m} className="bg-[#17120e] text-[#f0e5c9]">
                  {m}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-70" />
          </div>

          {/* URL Input Bar */}
          <div className="relative flex-1">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#756b5a]">
              <Globe className="h-3.5 w-3.5" />
            </div>
            <input
              id="http-url-bar"
              type="text"
              value={currentUrl}
              onChange={(e) => setField('url', e.target.value)}
              placeholder="https://api.example.com/v1/resource"
              aria-invalid={Boolean(errors.url)}
              className="h-9 w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] pl-8 pr-8 text-xs font-mono text-[#f0e5c9] outline-none transition placeholder:text-[#756b5a] focus:border-[#c69b45]"
            />
            {currentUrl && (
              <button
                type="button"
                aria-label="Clear URL"
                onClick={() => setField('url', '')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#756b5a] hover:text-[#e18a7a]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Send / Quick Test Action Button */}
          <button
            type="button"
            title="Test request immediately"
            disabled={isTesting || !currentUrl.trim()}
            onClick={() => {
              setActiveTab('test')
              void runTestRequest()
            }}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-[#8e7139]/40 bg-[#251c14] px-3 text-xs font-medium text-[#f0d58e] shadow-sm transition hover:border-[#c69b45] hover:bg-[#34271c] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isTesting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#c69b45]" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>

        {errors.url && (
          <p role="alert" className="mt-2 flex items-center gap-1 text-[11px] text-[#e18a7a]">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {errors.url}
          </p>
        )}

        {/* Dynamic Variable Insertion Helper Chips */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-[#756b5a]">Insert expression:</span>
          {VARIABLE_TEMPLATES.map((varName) => (
            <button
              key={varName}
              type="button"
              onClick={() => insertVariable('url', varName)}
              className="rounded bg-[#1f1812] px-1.5 py-0.5 text-[10px] font-mono text-[#d4ad58] transition hover:bg-[#2e2319] hover:text-[#f0d58e]"
            >
              + {varName}
            </button>
          ))}
        </div>
      </div>

      {/* 2. TABBED NAVIGATION BAR */}
      <div className="flex border-b border-[#8e7139]/25 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('params')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 font-medium transition ${activeTab === 'params'
            ? 'border-[#c69b45] text-[#f0d58e]'
            : 'border-transparent text-[#9f927b] hover:text-[#e5d8b8]'
            }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>Params</span>
          {validParamsCount > 0 && (
            <span className="rounded-full bg-[#8e7139]/30 px-1.5 text-[10px] text-[#f0d58e]">
              {validParamsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('headers')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 font-medium transition ${activeTab === 'headers'
            ? 'border-[#c69b45] text-[#f0d58e]'
            : 'border-transparent text-[#9f927b] hover:text-[#e5d8b8]'
            }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Headers</span>
          {validHeadersCount > 0 && (
            <span className="rounded-full bg-[#8e7139]/30 px-1.5 text-[10px] text-[#f0d58e]">
              {validHeadersCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('auth')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 font-medium transition ${activeTab === 'auth'
            ? 'border-[#c69b45] text-[#f0d58e]'
            : 'border-transparent text-[#9f927b] hover:text-[#e5d8b8]'
            }`}
        >
          <KeyRound className="h-3.5 w-3.5" />
          <span>Auth</span>
          {currentAuth !== 'none' && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('body')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 font-medium transition ${activeTab === 'body'
            ? 'border-[#c69b45] text-[#f0d58e]'
            : 'border-transparent text-[#9f927b] hover:text-[#e5d8b8]'
            }`}
        >
          <Code2 className="h-3.5 w-3.5" />
          <span>Body</span>
          {currentBody.trim() && (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('test')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 font-medium transition ${activeTab === 'test'
            ? 'border-[#c69b45] text-[#f0d58e]'
            : 'border-transparent text-[#9f927b] hover:text-[#e5d8b8]'
            }`}
        >
          <Play className="h-3.5 w-3.5" />
          <span>Test</span>
          {testResult && (
            <span className={`h-1.5 w-1.5 rounded-full ${testResult.status < 400 ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          )}
        </button>
      </div>

      {/* 3. TAB PANELS */}
      {/* TAB A: PARAMS */}
      {activeTab === 'params' && (
        <div className="space-y-4">
          <p className="text-xs text-[#9f927b]">
            Query parameters are appended to the URL as a query string (e.g. <code>?key=value</code>).
          </p>
          {renderKeyValueRows('queryParams', 'Query Parameters', currentQueryParams, 'param', 'value')}
        </div>
      )}

      {/* TAB B: HEADERS */}
      {activeTab === 'headers' && (
        <div className="space-y-4">
          <p className="text-xs text-[#9f927b]">
            Set custom HTTP headers sent along with the request.
          </p>
          {renderKeyValueRows('headers', 'Request Headers', currentHeaders, 'Header-Name', 'Header-Value')}
        </div>
      )}

      {/* TAB C: AUTHENTICATION */}
      {activeTab === 'auth' && (
        <div className="space-y-4">
          <div>
            <label htmlFor="http-auth-type" className="block text-xs font-medium text-[#c9b991]">
              Authentication Mode
            </label>
            <select
              id="http-auth-type"
              value={currentAuth}
              onChange={(e) => setField('authentication', e.target.value)}
              className="mt-1.5 w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-3 py-2.5 text-xs text-[#f0e5c9] outline-none transition focus:border-[#c69b45]"
            >
              <option value="none">No authentication</option>
              <option value="bearer">Bearer Token (Authorization: Bearer …)</option>
              <option value="apiKey">API Key (Custom Header)</option>
              <option value="basic">Basic Auth (Username & Password)</option>
            </select>
          </div>

          {currentAuth === 'bearer' && (
            <div className="rounded-md border border-[#8e7139]/25 bg-[#14100c] p-3.5 space-y-2">
              <label htmlFor="http-bearer-token" className="block text-xs font-medium text-[#c9b991]">
                Bearer Token <span className="text-[#d98a74]">*</span>
              </label>
              <div className="relative">
                <input
                  id="http-bearer-token"
                  type={showBearerToken ? 'text' : 'password'}
                  autoComplete="off"
                  value={value.bearerToken ?? ''}
                  onChange={(e) => setField('bearerToken', e.target.value)}
                  placeholder="e.g. ghp_xxxxxxxxxxxxxxxxxxxx"
                  aria-invalid={Boolean(errors.bearerToken)}
                  className="w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-3 py-2 pr-9 text-xs font-mono text-[#f0e5c9] outline-none transition focus:border-[#c69b45]"
                />
                <button
                  type="button"
                  onClick={() => setShowBearerToken(!showBearerToken)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#756b5a] hover:text-[#c9b991]"
                >
                  {showBearerToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {errors.bearerToken && (
                <p role="alert" className="text-[11px] text-[#e18a7a]">{errors.bearerToken}</p>
              )}
              <p className="text-[11px] text-[#756b5a]">
                Automatically added to headers as: <code>Authorization: Bearer &lt;token&gt;</code>
              </p>
            </div>
          )}

          {currentAuth === 'apiKey' && (
            <div className="rounded-md border border-[#8e7139]/25 bg-[#14100c] p-3.5 space-y-3">
              <div>
                <label htmlFor="http-api-key-name" className="block text-xs font-medium text-[#c9b991]">
                  Header Name <span className="text-[#d98a74]">*</span>
                </label>
                <input
                  id="http-api-key-name"
                  type="text"
                  value={value.apiKeyName ?? 'X-API-Key'}
                  onChange={(e) => setField('apiKeyName', e.target.value)}
                  placeholder="X-API-Key or Authorization"
                  aria-invalid={Boolean(errors.apiKeyName)}
                  className="mt-1 w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-3 py-2 text-xs font-mono text-[#f0e5c9] outline-none transition focus:border-[#c69b45]"
                />
                {errors.apiKeyName && (
                  <p role="alert" className="mt-1 text-[11px] text-[#e18a7a]">{errors.apiKeyName}</p>
                )}
              </div>

              <div>
                <label htmlFor="http-api-key-value" className="block text-xs font-medium text-[#c9b991]">
                  Key Value <span className="text-[#d98a74]">*</span>
                </label>
                <div className="relative mt-1">
                  <input
                    id="http-api-key-value"
                    type={showApiKeyValue ? 'text' : 'password'}
                    autoComplete="off"
                    value={value.apiKeyValue ?? ''}
                    onChange={(e) => setField('apiKeyValue', e.target.value)}
                    placeholder="Secret API key value"
                    aria-invalid={Boolean(errors.apiKeyValue)}
                    className="w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-3 py-2 pr-9 text-xs font-mono text-[#f0e5c9] outline-none transition focus:border-[#c69b45]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKeyValue(!showApiKeyValue)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#756b5a] hover:text-[#c9b991]"
                  >
                    {showApiKeyValue ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {errors.apiKeyValue && (
                  <p role="alert" className="mt-1 text-[11px] text-[#e18a7a]">{errors.apiKeyValue}</p>
                )}
              </div>
            </div>
          )}

          {currentAuth === 'basic' && (
            <div className="rounded-md border border-[#8e7139]/25 bg-[#14100c] p-3.5 space-y-3">
              <div>
                <label htmlFor="http-basic-username" className="block text-xs font-medium text-[#c9b991]">
                  Username <span className="text-[#d98a74]">*</span>
                </label>
                <input
                  id="http-basic-username"
                  type="text"
                  value={value.basicUsername ?? ''}
                  onChange={(e) => setField('basicUsername', e.target.value)}
                  placeholder="Username / Client ID"
                  aria-invalid={Boolean(errors.basicUsername)}
                  className="mt-1 w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-3 py-2 text-xs font-mono text-[#f0e5c9] outline-none transition focus:border-[#c69b45]"
                />
                {errors.basicUsername && (
                  <p role="alert" className="mt-1 text-[11px] text-[#e18a7a]">{errors.basicUsername}</p>
                )}
              </div>

              <div>
                <label htmlFor="http-basic-password" className="block text-xs font-medium text-[#c9b991]">
                  Password
                </label>
                <div className="relative mt-1">
                  <input
                    id="http-basic-password"
                    type={showBasicPassword ? 'text' : 'password'}
                    autoComplete="off"
                    value={value.basicPassword ?? ''}
                    onChange={(e) => setField('basicPassword', e.target.value)}
                    placeholder="Password / Secret"
                    className="w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-3 py-2 pr-9 text-xs font-mono text-[#f0e5c9] outline-none transition focus:border-[#c69b45]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBasicPassword(!showBasicPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#756b5a] hover:text-[#c9b991]"
                  >
                    {showBasicPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB D: REQUEST BODY */}
      {activeTab === 'body' && (
        <div className="space-y-3">
          {!METHODS_WITH_BODY.includes(currentMethod) && (
            <div className="flex items-center gap-2 rounded-md border border-amber-800/30 bg-amber-950/20 p-2.5 text-xs text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                HTTP <strong>{currentMethod}</strong> requests normally do not include a body. The body will only be dispatched if the endpoint expects it.
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label htmlFor="http-body-editor" className="text-xs font-medium text-[#c9b991]">
              JSON Payload Template
            </label>
            <div className="flex items-center gap-2">
              {jsonStatus && (
                <span className={`text-[10px] ${jsonStatus.valid ? 'text-emerald-400' : 'text-[#e18a7a]'}`}>
                  {jsonStatus.valid ? '✓ Valid JSON' : '⚠ Invalid JSON'}
                </span>
              )}
              <button
                type="button"
                onClick={formatJsonBody}
                disabled={!currentBody.trim()}
                className="rounded border border-[#8e7139]/30 px-2 py-0.5 text-[11px] text-[#d4ad58] hover:border-[#c69b45] disabled:opacity-40"
              >
                Format JSON
              </button>
            </div>
          </div>

          <textarea
            id="http-body-editor"
            value={currentBody}
            onChange={(e) => setField('body', e.target.value)}
            rows={8}
            placeholder={'{\n  "userId": "{{trigger.body.id}}",\n  "status": "active"\n}'}
            className="w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] p-3 font-mono text-xs text-[#f0e5c9] outline-none transition placeholder:text-[#756b5a] focus:border-[#c69b45]"
          />

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-[#756b5a]">Payload helpers:</span>
            <button
              type="button"
              onClick={() => insertVariable('body', '{\n  "data": {{trigger.body}}\n}')}
              className="rounded bg-[#1f1812] px-1.5 py-0.5 text-[10px] font-mono text-[#d4ad58] hover:bg-[#2e2319]"
            >
              Pass through trigger body
            </button>
            <button
              type="button"
              onClick={() => insertVariable('body', '{\n  "timestamp": "{{trigger.timestamp}}"\n}')}
              className="rounded bg-[#1f1812] px-1.5 py-0.5 text-[10px] font-mono text-[#d4ad58] hover:bg-[#2e2319]"
            >
              Add timestamp
            </button>
          </div>
        </div>
      )}

      {/* TAB E: TEST & LIVE RESPONSE VIEWER */}
      {activeTab === 'test' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-[#f0d58e]">Live Request Testing</h3>
              <p className="text-[11px] text-[#81745f]">Send a test request directly to inspect the response.</p>
            </div>
            <button
              type="button"
              disabled={isTesting || !currentUrl.trim()}
              onClick={() => void runTestRequest()}
              className="flex items-center gap-1.5 rounded-md bg-[#c69b45] px-3 py-1.5 text-xs font-semibold text-[#21170c] transition hover:bg-[#dfb95f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              <span>{isTesting ? 'Sending…' : 'Execute Test'}</span>
            </button>
          </div>

          {testError && (
            <div className="rounded-md border border-rose-800/40 bg-rose-950/25 p-3 text-xs text-rose-300">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Request Failed</span>
                {testError.durationMs !== undefined && (
                  <span className="text-[10px] text-rose-400">{testError.durationMs}ms</span>
                )}
              </div>
              <p className="mt-1 text-[11px]">{testError.message}</p>
              <p className="mt-2 text-[10px] text-rose-400/80">
                Note: Browser security (CORS) might restrict requests to external APIs during direct browser testing. The full server engine bypasses CORS during workflow execution.
              </p>
            </div>
          )}

          {testResult && (
            <div className="space-y-3 rounded-md border border-[#8e7139]/35 bg-[#14100c] p-3">
              <div className="flex items-center justify-between border-b border-[#8e7139]/20 pb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-bold ${testResult.status < 300
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : testResult.status < 400
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-rose-500/20 text-rose-400'
                      }`}
                  >
                    {testResult.status} {testResult.statusText || 'OK'}
                  </span>
                  <span className="text-[11px] text-[#81745f]">{testResult.durationMs}ms</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const text = typeof testResult.data === 'object' ? JSON.stringify(testResult.data, null, 2) : String(testResult.data)
                    navigator.clipboard.writeText(text)
                    setCopiedResponse(true)
                    setTimeout(() => setCopiedResponse(false), 2000)
                  }}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[#d4ad58] hover:text-[#f0d58e]"
                >
                  {copiedResponse ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedResponse ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wider text-[#81745f]">Response Body</p>
                <pre className="max-h-60 overflow-auto rounded bg-[#0d0a08] p-2.5 font-mono text-[11px] text-[#e5d8b8]">
                  {typeof testResult.data === 'object'
                    ? JSON.stringify(testResult.data, null, 2)
                    : String(testResult.data || '(Empty response)')}
                </pre>
              </div>
            </div>
          )}

          {!testResult && !testError && !isTesting && (
            <div className="rounded-md border border-dashed border-[#8e7139]/30 p-6 text-center">
              <Globe className="mx-auto h-7 w-7 text-[#8e7139]/60" />
              <p className="mt-2 text-xs font-medium text-[#c9b991]">No test has been run yet</p>
              <p className="mt-1 text-[11px] text-[#756b5a]">
                Click "Execute Test" above or "Send" in the request bar to run this HTTP call.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
