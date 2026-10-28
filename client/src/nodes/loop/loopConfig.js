const LOOP_EXPRESSION = /^\{\{[\w.[\]-]+\}\}$/

export function validateLoopConfiguration(form = {}) {
  const errors = {}
  const mode = form.mode || 'forEach'
  const maxIterations = Number(form.maxIterations ?? 100)

  if (!['forEach', 'fixed'].includes(mode)) {
    errors.mode = 'Choose a supported loop mode.'
  }
  if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 1000) {
    errors.maxIterations = 'Maximum iterations must be a whole number from 1 to 1000.'
  }

  if (mode === 'forEach') {
    if (typeof form.arrayExpression !== 'string' || !LOOP_EXPRESSION.test(form.arrayExpression.trim())) {
      errors.arrayExpression = 'Enter an expression that resolves to an array, such as {{nodes.httpRequest1.output.data}}.'
    }
  } else if (mode === 'fixed') {
    const iterations = Number(form.iterations)
    if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1000) {
      errors.iterations = 'Iteration count must be a whole number from 1 to 1000.'
    } else if (Number.isInteger(maxIterations) && iterations > maxIterations) {
      errors.iterations = 'Iteration count cannot exceed the maximum iterations.'
    }
  }

  return errors
}

const loopConfig = {
  label: 'Loop',
  description: 'Repeat a connected body of workflow nodes for each item or a fixed number of times.',
  defaults: {
    mode: 'forEach',
    arrayExpression: '',
    iterations: 1,
    maxIterations: 100,
  },
  fields: [],
  validate: validateLoopConfiguration,
}

export default loopConfig
