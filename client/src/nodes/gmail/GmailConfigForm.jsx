import { useEffect, useState } from 'react'

const inputClassName =
  'mt-1.5 w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-3 py-2.5 text-sm text-[#f0e5c9] outline-none transition placeholder:text-[#756b5a] focus:border-[#c69b45]'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function GmailConfigForm({ schema, value, errors = {}, onChange }) {
  const [connected, setConnected] = useState(false)
  const [email, setEmail] = useState('');
  const [connectionMessage, setConnectionMessage] = useState('')

  const setField = (key, nextValue) =>
    onChange({ ...value, [key]: nextValue })


  useEffect(() => {
    let active = true

    const loadConnectionStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/gmail/status`, {
          credentials: 'include',
        })
        if (!response.ok) throw new Error('Gmail status request failed')

        const data = await response.json()
        if (!active) return false
        setConnected(Boolean(data.connected))
        setEmail(data.email || '')
        return Boolean(data.connected)
      } catch {
        if (active) {
          setConnectionMessage('Unable to check Gmail connection. Check your backend.')
        }
        return false
      }
    }

    const handleOAuthMessage = (event) => {
      if (
        event.origin !== new URL(API_URL).origin ||
        event.data?.type !== 'oauth-result' ||
        event.data?.provider !== 'gmail'
      ) {
        return
      }

      if (!event.data.connected) {
        setConnectionMessage(event.data.error || 'Google authorization failed.')
        return
      }

      void loadConnectionStatus().then((isConnected) => {
        if (active) {
          setConnectionMessage(
            isConnected
              ? 'Gmail connected.'
              : 'Google authorization was not confirmed by the backend.',
          )
        }
      })
    }

    void loadConnectionStatus()
    window.addEventListener('message', handleOAuthMessage)
    return () => {
      active = false
      window.removeEventListener('message', handleOAuthMessage)
    }
  }, [])

  const connectGmail = () => {
    const popup = window.open(
      `${API_URL}/api/v1/gmail/connect`,
      'gmail-oauth',
      'width=600,height=700',
    )

    if (!popup) {
      setConnectionMessage('Please allow popups for this site.')
    } else {
      setConnectionMessage('Complete authorization in the Google popup.')
    }
  }

  const disconnectGmail = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/gmail/disconnect`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Gmail disconnect request failed')

      setConnected(false)
      setEmail('')
      setConnectionMessage('Gmail disconnected.')
    } catch {
      setConnectionMessage('Could not disconnect Gmail.')
    }
  }

  const visibleFields = schema.fields.filter(
    (field) => !field.when || field.when({ form: value }),
  )

  return (
    <div className="space-y-5">
      {visibleFields.map((field) => {
        const error = errors[field.key]
        const fieldId = `gmail-config-${field.key}`

        if (field.type === 'integration') {
          return (
            <section
              key={field.key}
              className="rounded-md border border-[#8e7139]/25 bg-[#100d0a]/70 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-[#c9b991]">
                  {connected
                    ? `Connected${email ? ` as ${email}` : ''}`
                    : 'Not connected'}
                </span>

                <span className="rounded-full border border-[#8e7139]/30 px-2 py-1 text-[10px] uppercase tracking-wide text-[#a9997b]">
                  {connected ? 'Authorized' : 'Gmail OAuth'}
                </span>
              </div>

              <p className="mt-2 text-xs font-medium text-[#c9b991]">
                {field.label}
              </p>

              <p className="mt-1 text-[11px] leading-relaxed text-[#8f8065]">
                {field.description}
              </p>

              {connected ? (
                <button
                  type="button"
                  onClick={disconnectGmail}
                  className="mt-3 w-full rounded-md border border-red-900/50 px-3 py-2.5 text-xs text-red-300 hover:bg-red-950/30"
                >
                  Disconnect Gmail
                </button>
              ) : (
                <button
                  type="button"
                  onClick={connectGmail}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-[#8e7139]/45 bg-[#c69b45]/10 px-3 py-2.5 text-xs font-medium text-[#f0e5c9] transition hover:border-[#c69b45] hover:bg-[#c69b45]/20"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="17"
                    height="17"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm-1.4 2L12 10.7 5.4 6h13.2ZM4 18V7.3l7.4 5.3a1 1 0 0 0 1.2 0L20 7.3V18H4Z" />
                  </svg>
                  Connect Gmail
                </button>
              )}

              <p role="status" className="mt-2 text-[11px] leading-relaxed text-[#8f8065]">
                {connectionMessage ||
                  (connected
                    ? 'Your Gmail account is authorized.'
                    : "You'll be redirected to Google to authorize access.")}
              </p>
            </section>
          )
        }

        if (field.type === 'checkbox') {
          return (
            <label
              key={field.key}
              htmlFor={fieldId}
              className="flex cursor-pointer items-center gap-2.5 rounded-md border border-[#8e7139]/25 bg-[#100d0a]/70 px-3 py-2.5 text-xs text-[#c9b991]"
            >
              <input
                id={fieldId}
                type="checkbox"
                checked={Boolean(value[field.key])}
                onChange={(event) =>
                  setField(field.key, event.target.checked)
                }
                className="h-4 w-4 accent-[#c69b45]"
              />
              {field.label}
            </label>
          )
        }

        const commonProps = {
          id: fieldId,
          value: value[field.key] ?? '',
          onChange: (event) =>
            setField(field.key, event.target.value),
          'aria-invalid': Boolean(error),
          'aria-describedby': error ? `${fieldId}-error` : undefined,
          className: inputClassName,
          required: Boolean(field.required),
        }

        const label = (
          <label
            htmlFor={fieldId}
            className="block text-xs font-medium text-[#c9b991]"
          >
            {field.label}
            {field.required && (
              <span className="ml-1 text-[#d98a74]">*</span>
            )}
          </label>
        )

        return (
          <div key={field.key}>
            {label}

            {field.type === 'select' ? (
              <select {...commonProps}>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea
                {...commonProps}
                rows={field.rows ?? 4}
                placeholder={field.placeholder}
              />
            ) : (
              <input
                {...commonProps}
                type={field.type === 'text' ? 'text' : field.type}
                placeholder={field.placeholder}
              />
            )}

            {field.description && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#8f8065]">
                {field.description}
              </p>
            )}

            {error && (
              <p
                id={`${fieldId}-error`}
                role="alert"
                className="mt-1.5 text-[11px] text-[#e18a7a]"
              >
                {error}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default GmailConfigForm