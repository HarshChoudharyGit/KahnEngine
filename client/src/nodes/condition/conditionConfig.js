import { validateConditionConfiguration } from './conditionUtils.js'

const conditionConfig = {
  label: 'If / Else',
  description: 'Choose a value and comparison to route the workflow through a matching branch.',
  defaults: {
    leftValue: '',
    operator: 'equals',
    rightValue: '',
    rightValueType: 'text',
  },
  fields: [],
  validate: validateConditionConfiguration,
}

export default conditionConfig
