import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

const inputClassName = 'mt-1.5 w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-3 py-2.5 text-sm text-[#f0e5c9] outline-none transition placeholder:text-[#756b5a] focus:border-[#c69b45]'

function NodeConfigForm({ schema, value, errors, onChange }) {
  const [integrationNotice, setIntegrationNotice] = useState('')
  const setField = (key, nextValue) => onChange({ ...value, [key]: nextValue })

  const renderKeyValueEditor = (field) => {
    const rows = value[field.key] ?? []
    const updateRow = (index, key, nextValue) => {
      setField(field.key, rows.map((row, rowIndex) => (
        rowIndex === index ? { ...row, [key]: nextValue } : row
      )))
    }

    return (
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={`${field.key}-${index}`} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <input
                aria-label={`${field.label} key ${index + 1}`}
                value={row.key}
                onChange={(event) => updateRow(index, 'key', event.target.value)}
                placeholder="Key"
                className="w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-2.5 py-2 text-xs text-[#f0e5c9] outline-none placeholder:text-[#756b5a] focus:border-[#c69b45]"
              />
              {errors[`${field.key}.${index}.key`] && (
                <p className="mt-1 text-[11px] text-[#e18a7a]">{errors[`${field.key}.${index}.key`]}</p>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <input
                aria-label={`${field.label} value ${index + 1}`}
                value={row.value}
                onChange={(event) => updateRow(index, 'value', event.target.value)}
                placeholder="Value"
                className="w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-2.5 py-2 text-xs text-[#f0e5c9] outline-none placeholder:text-[#756b5a] focus:border-[#c69b45]"
              />
              {errors[`${field.key}.${index}.value`] && (
                <p className="mt-1 text-[11px] text-[#e18a7a]">{errors[`${field.key}.${index}.value`]}</p>
              )}
            </div>
            <button
              type="button"
              aria-label={`Remove ${field.label.toLowerCase()} row ${index + 1}`}
              onClick={() => setField(field.key, rows.filter((_, rowIndex) => rowIndex !== index))}
              className="mt-1 flex h-8 w-8 cursor-pointer shrink-0 items-center justify-center rounded text-[#a9997b] transition hover:bg-[#8f4d3b]/15 hover:text-[#e18a7a]"
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setField(field.key, [...rows, { key: '', value: '' }])}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded px-1 py-1 text-xs text-[#d4ad58] transition hover:text-[#f0d58e]"
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
          Add {field.label.toLowerCase().replace(/s$/, '')}
        </button>
      </div>
    )
  }

  const renderField = (field) => {
    const error = errors[field.key]
    const commonProps = {
      id: `node-config-${field.key}`,
      value: value[field.key] ?? '',
      onChange: (event) => setField(
        field.key,
        field.type === 'number' ? Number(event.target.value) : event.target.value,
      ),
      className: inputClassName,
      'aria-invalid': Boolean(error),
      'aria-describedby': error ? `node-config-${field.key}-error` : undefined,
    }

    if (field.type === 'integration') {
      const integrationName = field.integrationName ?? 'service'
      return (
        <div className="rounded-md border border-[#8e7139]/25 bg-[#100d0a]/70 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#c9b991]">Not connected</span>
            <span className="rounded-full border border-[#8e7139]/30 px-2 py-1 text-[10px] uppercase tracking-wide text-[#a9997b]">
              Backend required
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIntegrationNotice(`${integrationName} is not connected. No connection was made.`)}
            className="mt-3 w-full cursor-pointer rounded-md border border-[#8e7139]/40 px-3 py-2 text-xs font-medium text-[#f0d58e] transition hover:border-[#c69b45] hover:bg-[#d4ad58]/8"
          >
            Connect {integrationName}
          </button>
          <p className="mt-2 text-[11px] leading-relaxed text-[#8f8065]">{field.description}</p>
          <p className="mt-2 text-[11px] leading-relaxed text-[#8f8065]">
            This demo will not simulate a connection. Configure the workspace integration backend to authorize {integrationName}.
          </p>
          {integrationNotice && (
            <p role="status" className="mt-2 text-[11px] leading-relaxed text-[#e0bb72]">{integrationNotice}</p>
          )}
        </div>
      )
    }

    if (field.type === 'keyValue') return renderKeyValueEditor(field)

    if (field.type === 'checkbox') {
      return (
        <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-[#8e7139]/25 bg-[#100d0a]/70 px-3 py-2.5 text-xs text-[#c9b991]">
          <input
            id={commonProps.id}
            type="checkbox"
            checked={Boolean(value[field.key])}
            onChange={(event) => setField(field.key, event.target.checked)}
            className="h-4 w-4 accent-[#c69b45]"
          />
          {field.label}
        </label>
      )
    }

    if (field.type === 'multiselect') {
      const selectedValues = value[field.key] ?? []
      return (
        <div className="grid grid-cols-2 gap-2">
          {field.options.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-md border border-[#8e7139]/25 bg-[#100d0a]/70 px-2.5 py-2.5 text-xs text-[#c9b991]">
              <input
                type="checkbox"
                checked={selectedValues.includes(option.value)}
                onChange={(event) => setField(
                  field.key,
                  event.target.checked
                    ? [...selectedValues, option.value]
                    : selectedValues.filter((item) => item !== option.value),
                )}
                className="h-3.5 w-3.5 accent-[#c69b45]"
              />
              {option.label}
            </label>
          ))}
        </div>
      )
    }

    let input
    if (field.type === 'textarea') {
      input = <textarea {...commonProps} rows={field.rows ?? 3} placeholder={field.placeholder} />
    } else if (field.type === 'select') {
      input = (
        <select {...commonProps} className={`${inputClassName} cursor-pointer`}>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      )
    } else {
      input = (
        <input
          {...commonProps}
          type={field.type}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          step={field.step}
        />
      )
    }

    return (
      <>
        {input}
        {field.description && <p className="mt-1.5 text-[11px] leading-relaxed text-[#8f8065]">{field.description}</p>}
      </>
    )
  }

  return (
    <div className="space-y-5">
      {schema.fields.map((field) => {
        if (field.when && !field.when({ form: value })) return null
        const error = errors[field.key]

        return (
          <div key={field.key}>
            {field.type !== 'checkbox' && (
              <label htmlFor={`node-config-${field.key}`} className="block text-xs font-medium text-[#c9b991]">
                {field.label}{field.required && <span className="ml-1 text-[#d98a74]">*</span>}
              </label>
            )}
            {renderField(field)}
            {error && (
              <p id={`node-config-${field.key}-error`} role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">
                {error}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default NodeConfigForm
