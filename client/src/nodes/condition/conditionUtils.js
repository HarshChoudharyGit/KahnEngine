const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals', requiresRightValue: true },
  { value: 'notEquals', label: 'Does not equal', requiresRightValue: true },
  { value: 'contains', label: 'Contains', requiresRightValue: true },
  { value: 'greaterThan', label: 'Is greater than', requiresRightValue: true, numeric: true },
  { value: 'lessThan', label: 'Is less than', requiresRightValue: true, numeric: true },
  { value: 'isEmpty', label: 'Is empty', requiresRightValue: false },
]

const EXPRESSION_PATTERN = /^\{\{\s*([\w.[\]-]+)\s*\}\}$/
const FIELD_PATH_PATTERN = /^[\w-]+(?:\.[\w-]+)*$/

function isVariableExpression(value) {
  return typeof value === 'string' && EXPRESSION_PATTERN.test(value.trim())
}

function isUnwrappedVariablePath(value) {
  return typeof value === 'string' && /^(trigger|nodes|outputs)\.[\w.[\]-]+$/.test(value.trim())
}

function titleCase(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getNodeDisplayName(node) {
  return node?.data?.configuration?.title || node?.data?.title || ''
}

function getOutputFieldLabel(node, fields) {
  const rawSchema = node?.data?.configuration?.outputSchema || node?.data?.outputSchema
  if (!rawSchema || !fields.length) return null

  let schema
  try {
    schema = typeof rawSchema === 'string' ? JSON.parse(rawSchema) : rawSchema
  } catch {
    return null
  }

  const labels = []
  let current = schema
  for (const field of fields) {
    if (field === 'structured' || field === 'data') {
      current = current?.properties?.[field] || current
      continue
    }
    const property = current?.properties?.[field]
    labels.push(property?.title || titleCase(field))
    current = property
  }
  return labels.length ? labels.slice(-2).join(' → ') : null
}

function getReadableVariableLabel(expression, nodes = []) {
  if (typeof expression !== 'string') return 'Selected value'
  const match = expression.trim().match(EXPRESSION_PATTERN)
  if (!match) return 'Selected value'

  const parts = match[1].split('.')
  if (parts[0] === 'trigger') {
    const fields = parts.slice(1).filter((part) => part !== 'body')
    const fieldLabel = fields.length ? titleCase(fields.slice(-2).join(' → ')) : 'Event data'
    return `Trigger → ${fieldLabel}`
  }

  if (parts[0] === 'nodes' || parts[0] === 'outputs') {
    const nodeId = parts[1]
    const node = nodes.find((candidate) => candidate.id === nodeId)
    const nodeName = getNodeDisplayName(node)
    const fields = parts.slice(2).filter((part) => part !== 'output')
    const fieldLabel = fields.length
      ? getOutputFieldLabel(node, fields) || titleCase(
        fields.filter((part, index) => !(['structured', 'data'].includes(part) && index < fields.length - 1))
          .slice(-2)
          .join(' → '),
      )
      : 'Output'
    return nodeName ? `${nodeName} → ${fieldLabel}` : `Previous step output → ${fieldLabel}`
  }

  return 'Selected value'
}

function getConditionOperatorLabel(operator) {
  return CONDITION_OPERATORS.find((item) => item.value === operator)?.label || 'Choose an operator'
}

function formatConditionValue(value, nodes) {
  if (isVariableExpression(value)) return getReadableVariableLabel(value, nodes)
  if (isUnwrappedVariablePath(value)) {
    return getReadableVariableLabel(`{{${value.trim()}}}`, nodes)
  }
  if (value === true) return 'true'
  if (value === false) return 'false'
  if (value === null || value === undefined || value === '') return 'a value'
  if (typeof value === 'object') return 'a selected value'
  return String(value)
}

function getConditionSummary(configuration = {}, nodes = []) {
  const leftLabel = configuration.leftValue
    ? getReadableVariableLabel(configuration.leftValue, nodes)
    : 'Choose a value'
  const operatorLabel = getConditionOperatorLabel(configuration.operator)
  const operator = CONDITION_OPERATORS.find((item) => item.value === configuration.operator)

  if (!operator?.requiresRightValue) return `${leftLabel} · ${operatorLabel}`
  return `${leftLabel} · ${operatorLabel} · ${formatConditionValue(configuration.rightValue, nodes)}`
}

function getUpstreamNodes(nodes, edges, currentNodeId) {
  const upstreamIds = new Set()
  const pending = [currentNodeId]

  while (pending.length) {
    const targetId = pending.pop()
    for (const edge of edges) {
      if (edge.target === targetId && !upstreamIds.has(edge.source)) {
        upstreamIds.add(edge.source)
        pending.push(edge.source)
      }
    }
  }

  return nodes.filter((node) => upstreamIds.has(node.id))
}

function getConditionVariableOptions(nodes = [], edges = [], currentNodeId, currentExpression) {
  const options = [
    { value: '{{trigger.body}}', label: 'Trigger → Event data' },
    ...getUpstreamNodes(nodes, edges, currentNodeId).map((node) => ({
      value: `{{nodes.${node.id}.output}}`,
      label: `${getNodeDisplayName(node) || 'Previous step'} → Output`,
    })),
  ]

  if (
    isVariableExpression(currentExpression) &&
    !options.some((option) => option.value === currentExpression)
  ) {
    options.push({
      value: currentExpression,
      label: getReadableVariableLabel(currentExpression, nodes),
    })
  }

  return options
}

function getVariableBase(expression) {
  if (!isVariableExpression(expression)) return null
  const path = expression.trim().slice(2, -2).trim()
  if (path === 'trigger.body' || path.startsWith('trigger.body.')) return '{{trigger.body}}'
  const match = path.match(/^(nodes\.[\w-]+\.output)(?:\..+)?$/)
  return match ? `{{${match[1]}}}` : null
}

function appendVariableField(expression, fieldPath) {
  const trimmedField = String(fieldPath ?? '').trim()
  if (!trimmedField) return expression
  const path = expression.trim().slice(2, -2).trim()
  return `{{${path}.${trimmedField}}}`
}

function hasValidVariableFieldPath(expression) {
  if (!isVariableExpression(expression)) return false
  const base = getVariableBase(expression)
  if (!base) return true

  const basePath = base.slice(2, -2)
  const fullPath = expression.trim().slice(2, -2)
  const fieldPath = fullPath === basePath ? '' : fullPath.slice(basePath.length + 1)
  return !fieldPath || FIELD_PATH_PATTERN.test(fieldPath)
}

function validateConditionConfiguration(form = {}) {
  const errors = {}
  const leftValue = form.leftValue
  const operator = CONDITION_OPERATORS.find((item) => item.value === form.operator)
  const hasLeftValue = typeof leftValue === 'string'
    ? Boolean(leftValue.trim())
    : leftValue !== null && leftValue !== undefined

  if (!hasLeftValue) errors.leftValue = 'Choose a value to check.'
  else if (typeof leftValue === 'string' && leftValue.includes('{{') && !isVariableExpression(leftValue)) {
    errors.leftValue = 'Choose a valid data field.'
  } else if (isVariableExpression(leftValue) && !hasValidVariableFieldPath(leftValue)) {
    errors.leftValue = 'Enter a valid field name.'
  }

  if (!operator) errors.operator = 'Select a comparison operator.'

  if (operator?.requiresRightValue) {
    const rightValue = form.rightValue
    const hasRightValue = typeof rightValue === 'string'
      ? Boolean(rightValue.trim())
      : rightValue !== null && rightValue !== undefined
    if (!hasRightValue) errors.rightValue = 'Enter a value to compare against.'
  }

  if (operator?.numeric && !errors.leftValue) {
    const isDynamicLeft = isVariableExpression(leftValue)
    const isDynamicRight = isVariableExpression(form.rightValue)
    const isNumericLeft = typeof leftValue === 'number' ||
      (typeof leftValue === 'string' && leftValue.trim() !== '' && Number.isFinite(Number(leftValue)))
    const isNumericRight = typeof form.rightValue === 'number' ||
      (typeof form.rightValue === 'string' && form.rightValue.trim() !== '' && Number.isFinite(Number(form.rightValue)))
    if (!isDynamicLeft && !isNumericLeft) {
      errors.leftValue = 'Choose a number or a data field that contains a number.'
    }
    if (
      !errors.rightValue &&
      !isDynamicRight &&
      (form.rightValueType !== 'number' || !isNumericRight)
    ) {
      errors.rightValue = 'Enter a number or choose a data field that contains a number.'
    }
  }

  if (
    operator?.requiresRightValue &&
    form.rightValueType === 'expression' &&
    form.rightValue &&
    (!isVariableExpression(form.rightValue) || !hasValidVariableFieldPath(form.rightValue))
  ) {
    errors.rightValue = 'Choose a valid data field.'
  }

  return errors
}

export {
  CONDITION_OPERATORS,
  appendVariableField,
  getConditionOperatorLabel,
  getConditionSummary,
  getConditionVariableOptions,
  getReadableVariableLabel,
  getVariableBase,
  hasValidVariableFieldPath,
  isVariableExpression,
  isUnwrappedVariablePath,
  validateConditionConfiguration,
}
