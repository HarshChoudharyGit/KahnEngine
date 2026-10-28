import { useMemo, useState } from 'react'
import {
  appendVariableField,
  CONDITION_OPERATORS,
  getConditionSummary,
  getConditionVariableOptions,
  getVariableBase,
  isVariableExpression,
  isUnwrappedVariablePath,
} from './conditionUtils.js'

const inputClassName = 'mt-1.5 w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-3 py-2.5 text-sm text-[#f0e5c9] outline-none transition focus:border-[#c69b45]'

function inferRightValueType(value, configuredType) {
  if (isVariableExpression(value) || isUnwrappedVariablePath(value)) return 'expression'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (configuredType) return configuredType
  return 'text'
}

function ConditionConfigForm({ node, nodes, edges, value, errors, onChange }) {
  const [fieldName, setFieldName] = useState('')
  const [rightFieldName, setRightFieldName] = useState('')
  const [rightValueType, setRightValueType] = useState(() =>
    inferRightValueType(value.rightValue, value.rightValueType),
  )

  const variableOptions = useMemo(
    () => getConditionVariableOptions(nodes, edges, node.id, value.leftValue),
    [nodes, edges, node.id, value.leftValue],
  )
  const rightVariableOptions = useMemo(
    () => getConditionVariableOptions(nodes, edges, node.id, value.rightValue),
    [nodes, edges, node.id, value.rightValue],
  )
  const leftValue = value.leftValue ?? ''
  const leftBase = getVariableBase(leftValue)
  const isBaseValue = Boolean(leftBase && leftBase === leftValue)
  const showFieldInput = Boolean(leftBase && (isBaseValue || fieldName))
  const rightType = inferRightValueType(value.rightValue, rightValueType)
  const rightBase = getVariableBase(value.rightValue)
  const showRightFieldInput = Boolean(rightBase && (rightBase === value.rightValue || rightFieldName))

  const update = (key, nextValue) => onChange({ ...value, [key]: nextValue })

  const selectLeftValue = (nextValue) => {
    setFieldName('')
    update('leftValue', nextValue)
  }

  const updateFieldName = (nextValue) => {
    setFieldName(nextValue)
    update('leftValue', appendVariableField(leftBase || leftValue, nextValue))
  }

  const changeRightType = (nextType) => {
    setRightFieldName('')
    setRightValueType(nextType)
    const initialValue = nextType === 'boolean'
      ? null
      : nextType === 'number'
        ? ''
        : nextType === 'expression'
          ? ''
          : ''
    onChange({
      ...value,
      rightValueType: nextType,
      rightValue: initialValue,
    })
  }

  const selectRightExpression = (expression) => {
    setRightFieldName('')
    setRightValueType('expression')
    onChange({ ...value, rightValueType: 'expression', rightValue: expression })
  }

  const updateRightFieldName = (nextValue) => {
    setRightFieldName(nextValue)
    setRightValueType('expression')
    onChange({
      ...value,
      rightValueType: 'expression',
      rightValue: appendVariableField(rightBase || value.rightValue, nextValue),
    })
  }

  const summary = getConditionSummary(value, nodes)

  return (
    <div className="space-y-5">
      <section className="space-y-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#c9b991]">Build a condition</h3>
        <p className="text-[11px] leading-relaxed text-[#8f8065]">
          Choose data from the trigger or a connected previous step. The workflow keeps the original data reference when saved.
        </p>
      </section>

      <div>
        <label htmlFor="condition-left-value" className="block text-xs font-medium text-[#c9b991]">
          Value to check <span className="ml-1 text-[#d98a74]">*</span>
        </label>
        <select
          id="condition-left-value"
          value={leftValue}
          onChange={(event) => selectLeftValue(event.target.value)}
          className={inputClassName}
          aria-invalid={Boolean(errors.leftValue)}
        >
          <option value="">Choose a value</option>
          {variableOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {showFieldInput && (
          <div className="mt-3">
            <label htmlFor="condition-field-name" className="block text-xs font-medium text-[#c9b991]">
              Field name <span className="font-normal text-[#81745f]">(optional)</span>
            </label>
            <input
              id="condition-field-name"
              type="text"
              value={fieldName}
              onChange={(event) => updateFieldName(event.target.value)}
              placeholder="For example, score"
              className={inputClassName}
              aria-invalid={Boolean(errors.leftValue)}
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#8f8065]">
              Add a field from this data, or leave blank to use the complete output.
            </p>
          </div>
        )}
        {errors.leftValue && (
          <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.leftValue}</p>
        )}
      </div>

      <div>
        <label htmlFor="condition-operator" className="block text-xs font-medium text-[#c9b991]">
          Comparison <span className="ml-1 text-[#d98a74]">*</span>
        </label>
        <select
          id="condition-operator"
          value={value.operator ?? ''}
          onChange={(event) => update('operator', event.target.value)}
          className={inputClassName}
          aria-invalid={Boolean(errors.operator)}
        >
          <option value="">Select a comparison</option>
          {CONDITION_OPERATORS.map((operator) => (
            <option key={operator.value} value={operator.value}>{operator.label}</option>
          ))}
        </select>
        {errors.operator && (
          <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.operator}</p>
        )}
      </div>

      {value.operator !== 'isEmpty' && (
        <div>
          <label htmlFor="condition-right-type" className="block text-xs font-medium text-[#c9b991]">
            Compare against <span className="ml-1 text-[#d98a74]">*</span>
          </label>
          <select
            id="condition-right-type"
            value={rightType}
            onChange={(event) => changeRightType(event.target.value)}
            className={inputClassName}
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="expression">Previous step value</option>
          </select>

          {rightType === 'boolean' ? (
            <select
              aria-label="Comparison boolean value"
              value={value.rightValue === true ? 'true' : value.rightValue === false ? 'false' : ''}
              onChange={(event) => update(
                'rightValue',
                event.target.value === '' ? null : event.target.value === 'true',
              )}
              className={inputClassName}
              aria-invalid={Boolean(errors.rightValue)}
            >
              <option value="">Choose true or false</option>
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          ) : rightType === 'expression' ? (
            <>
              <select
                aria-label="Comparison data value"
                value={isVariableExpression(value.rightValue) ? value.rightValue : ''}
                onChange={(event) => selectRightExpression(event.target.value)}
                className={inputClassName}
                aria-invalid={Boolean(errors.rightValue)}
              >
                <option value="">Choose a value</option>
                {rightVariableOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {showRightFieldInput && (
                <div className="mt-3">
                  <label htmlFor="condition-right-field-name" className="block text-xs font-medium text-[#c9b991]">
                    Field name <span className="font-normal text-[#81745f]">(optional)</span>
                  </label>
                  <input
                    id="condition-right-field-name"
                    type="text"
                    value={rightFieldName}
                    onChange={(event) => updateRightFieldName(event.target.value)}
                    placeholder="For example, score"
                    className={inputClassName}
                    aria-invalid={Boolean(errors.rightValue)}
                  />
                </div>
              )}
            </>
          ) : (
            <input
              id="condition-right-value"
              type={rightType === 'number' ? 'number' : 'text'}
              step={rightType === 'number' ? 'any' : undefined}
              value={value.rightValue ?? ''}
              onChange={(event) => update(
                'rightValue',
                rightType === 'number' && event.target.value !== ''
                  ? Number(event.target.value)
                  : event.target.value,
              )}
              placeholder={rightType === 'number' ? 'Enter a number' : 'Enter a value'}
              className={inputClassName}
              aria-invalid={Boolean(errors.rightValue)}
            />
          )}
          {errors.rightValue && (
            <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.rightValue}</p>
          )}
        </div>
      )}

      <section className="rounded-lg border border-violet-400/20 bg-violet-400/5 p-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-200/75">Condition summary</p>
        <p className="mt-1.5 text-xs leading-relaxed text-[#eee6d4]">{summary}</p>
        <p className="mt-2 text-[10px] leading-relaxed text-[#8f8065]">
          Matching data follows the TRUE branch; all other results follow FALSE.
        </p>
      </section>
    </div>
  )
}

export default ConditionConfigForm
