import { getNodeConfigSchema } from '../nodes/nodeConfigRegistry.js'

function defaultForField(field) {
  if (field.defaultValue !== undefined) return field.defaultValue
  if (field.type === 'select') return field.options?.[0]?.value ?? ''
  if (field.type === 'checkbox') return false
  if (field.type === 'multiselect') return []
  if (field.type === 'keyValue') return [{ key: '', value: '' }]
  if (field.type === 'number') return 1
  if (field.type !== 'integration') return ''
  return undefined
}

function hasRequiredValue(value) {
  if (typeof value === 'string') return Boolean(value.trim())
  if (Array.isArray(value)) return value.length > 0
  return value !== null && value !== undefined
}

export function validateNodeConfigurations(nodes) {
  return nodes.flatMap((node) => {
    const data = node.data ?? {}
    const schema = getNodeConfigSchema(data.configType || data.type || node.type || data.title)
    const configuration = data.configuration ?? {}
    const form = {
      ...schema.fields.reduce((defaults, field) => {
        if (field.key in (schema.defaults ?? {})) return defaults
        const value = defaultForField(field)
        if (value !== undefined) defaults[field.key] = value
        return defaults
      }, { ...(schema.defaults ?? {}) }),
      ...(!data.configType ? { title: data.title ?? '', subtitle: data.subtitle ?? '' } : {}),
      ...configuration,
    }

    for (const field of schema.fields) {
      if (field.type !== 'keyValue' || !Array.isArray(form[field.key])) continue
      form[field.key] = form[field.key].map((row) => ({
        key: String(row?.key ?? ''),
        value: String(row?.value ?? ''),
      }))
    }

    let fieldErrors
    try {
      fieldErrors = schema.validate(form) ?? {}
    } catch {
      fieldErrors = { configuration: 'Configuration could not be validated. Review this node’s settings.' }
    }

    for (const field of schema.fields) {
      if (!field.required || (field.when && !field.when({ form }))) continue
      if (!hasRequiredValue(form[field.key])) {
        fieldErrors[field.key] ||= `${field.label} is required.`
      }
    }

    const messages = [
      ...(data.configurationStatus === 'configured' ? [] : ['Save this node’s configuration before running the workflow.']),
      ...Object.values(fieldErrors).filter(Boolean),
    ]
    return messages.length > 0
      ? [{ nodeId: node.id, nodeTitle: data.title || node.id, messages }]
      : []
  })
}
