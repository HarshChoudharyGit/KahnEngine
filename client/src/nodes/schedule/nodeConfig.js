// Validates that a string contains 5 valid cron fields (minute, hour, dom, month, dow)
export function isValidCron(expression) {
  if (!expression || typeof expression !== 'string') return false
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return false

  // Basic regex validation for 5 cron fields: min (0-59), hour (0-23), day (1-31), month (1-12), day of week (0-7)
  const cronFieldRegex = /^(\*|[0-9,\-/]+)$/
  return parts.every((p) => cronFieldRegex.test(p))
}

// Converts form configuration (minutes, hours, daily, weekly, or cron) into a 5-field cron string
export function computeCronFromConfig(form) {
  const type = form.scheduleType || 'minutes'

  if (type === 'minutes') {
    const mins = Math.max(1, Math.min(59, parseInt(form.intervalMinutes || 5, 10)))
    return mins === 1 ? '* * * * *' : `*/${mins} * * * *`
  }

  if (type === 'hours') {
    const hrs = Math.max(1, Math.min(23, parseInt(form.intervalHours || 1, 10)))
    const min = Math.max(0, Math.min(59, parseInt(form.intervalMinuteOfHour || 0, 10)))
    return `${min} */${hrs} * * *`
  }

  if (type === 'daily') {
    const time = form.dailyTime || '09:00'
    const [h, m] = time.split(':').map((v) => parseInt(v, 10) || 0)
    return `${m} ${h} * * *`
  }

  if (type === 'weekly') {
    const time = form.weeklyTime || '09:00'
    const [h, m] = time.split(':').map((v) => parseInt(v, 10) || 0)
    const days = Array.isArray(form.weeklyDays) && form.weeklyDays.length > 0
      ? form.weeklyDays.join(',')
      : '1,2,3,4,5'
    return `${m} ${h} * * ${days}`
  }

  if (type === 'cron') {
    return (form.cronExpression || '*/5 * * * *').trim()
  }

  return '*/5 * * * *'
}

// Generates an English human-readable description from the schedule settings
export function computeScheduleSummary(form, cronExpr) {
  const type = form.scheduleType || 'minutes'
  const tz = form.timezone || 'Asia/Kolkata'

  if (type === 'minutes') {
    const mins = parseInt(form.intervalMinutes || 5, 10)
    return mins === 1 ? `Every minute (${tz})` : `Every ${mins} minutes (${tz})`
  }

  if (type === 'hours') {
    const hrs = parseInt(form.intervalHours || 1, 10)
    const min = String(form.intervalMinuteOfHour || 0).padStart(2, '0')
    return hrs === 1
      ? `Hourly at minute :${min} (${tz})`
      : `Every ${hrs} hours at minute :${min} (${tz})`
  }

  if (type === 'daily') {
    return `Daily at ${form.dailyTime || '09:00'} (${tz})`
  }

  if (type === 'weekly') {
    const dayLabels = {
      '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat', '0': 'Sun', '7': 'Sun',
    }
    const days = (form.weeklyDays || ['1', '2', '3', '4', '5'])
      .map((d) => dayLabels[d] || d)
      .join(', ')
    return `Weekly on [${days}] at ${form.weeklyTime || '09:00'} (${tz})`
  }

  return `Custom Cron: ${cronExpr} (${tz})`
}

const scheduleTriggerConfig = {
  label: 'Schedule Trigger',
  description: 'Trigger workflows automatically on interval, daily, weekly, or custom Cron schedules.',
  defaults: {
    scheduleType: 'minutes',
    intervalMinutes: 5,
    intervalHours: 1,
    intervalMinuteOfHour: 0,
    dailyTime: '09:00',
    weeklyDays: ['1', '2', '3', '4', '5'],
    weeklyTime: '09:00',
    cronExpression: '*/5 * * * *',
    timezone: 'Asia/Kolkata',
    enabled: true,
    summary: 'Every 5 minutes (Asia/Kolkata)',
  },
  fields: [
    { key: 'scheduleType', label: 'Schedule Type', type: 'select', defaultValue: 'minutes' },
    { key: 'cronExpression', label: 'Cron Expression', type: 'text', defaultValue: '*/5 * * * *', required: true },
    { key: 'timezone', label: 'Timezone', type: 'text', defaultValue: 'Asia/Kolkata' },
    { key: 'enabled', label: 'Enabled', type: 'checkbox', defaultValue: true },
  ],
  // Validates schedule configuration fields and bounds
  validate: (form) => {
    const errors = {}
    const cron = computeCronFromConfig(form)
    if (!isValidCron(cron)) {
      errors.cronExpression = 'Please enter a valid 5-field cron expression.'
    }
    if (form.scheduleType === 'minutes') {
      const m = parseInt(form.intervalMinutes, 10)
      if (isNaN(m) || m < 1 || m > 59) {
        errors.intervalMinutes = 'Interval minutes must be between 1 and 59.'
      }
    }
    if (form.scheduleType === 'hours') {
      const h = parseInt(form.intervalHours, 10)
      if (isNaN(h) || h < 1 || h > 24) {
        errors.intervalHours = 'Interval hours must be between 1 and 24.'
      }
    }
    if (form.scheduleType === 'weekly' && (!form.weeklyDays || form.weeklyDays.length === 0)) {
      errors.weeklyDays = 'Select at least one day of the week.'
    }
    return errors
  },
}

export default scheduleTriggerConfig
