// Validates that a string contains 5 valid cron fields (minute, hour, dom, month, dow)
export function isValidCron(expression) {
  if (!expression || typeof expression !== 'string') return false
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return false

  // Basic regex validation for 5 cron fields: min (0-59), hour (0-23), day (1-31), month (1-12), day of week (0-7)
  const cronFieldRegex = /^(\*|[0-9,\-/]+)$/
  return parts.every((p) => cronFieldRegex.test(p))
}

// Parses a single cron field into a Set of matching integers
function parseCronField(fieldStr, min, max) {
  if (!fieldStr || typeof fieldStr !== 'string') return null
  const parts = fieldStr.split(',')
  const matched = new Set()

  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed === '*') {
      for (let i = min; i <= max; i++) matched.add(i)
    } else if (trimmed.includes('/')) {
      const [rangePart, stepPart] = trimmed.split('/')
      const step = parseInt(stepPart, 10)
      if (isNaN(step) || step <= 0) return null

      let start = min
      let end = max
      if (rangePart !== '*') {
        if (rangePart.includes('-')) {
          const [s, e] = rangePart.split('-').map((v) => parseInt(v, 10))
          if (!isNaN(s) && !isNaN(e)) {
            start = Math.max(min, s)
            end = Math.min(max, e)
          }
        } else {
          const s = parseInt(rangePart, 10)
          if (!isNaN(s)) start = Math.max(min, s)
        }
      }
      for (let i = start; i <= end; i += step) {
        matched.add(i)
      }
    } else if (trimmed.includes('-')) {
      const [s, e] = trimmed.split('-').map((v) => parseInt(v, 10))
      if (isNaN(s) || isNaN(e)) return null
      for (let i = Math.max(min, s); i <= Math.min(max, e); i++) {
        matched.add(i)
      }
    } else {
      const val = parseInt(trimmed, 10)
      if (!isNaN(val) && val >= min && val <= max) {
        matched.add(val)
      } else {
        return null
      }
    }
  }

  return matched
}

// Extracts date parts in the target timezone
function getTzParts(date, tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
      hour12: false,
    }).formatToParts(date)

    const map = {}
    for (const p of parts) map[p.type] = p.value

    const dayNames = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    let hour = parseInt(map.hour, 10)
    if (hour === 24) hour = 0

    return {
      year: parseInt(map.year, 10),
      month: parseInt(map.month, 10),
      day: parseInt(map.day, 10),
      hour,
      minute: parseInt(map.minute, 10),
      weekday: dayNames[map.weekday] ?? 0,
    }
  } catch {
    return null
  }
}

// Computes relative time string from now
function formatRelativeTime(targetDate, now) {
  const diffMs = targetDate.getTime() - now.getTime()
  if (diffMs <= 0) return 'Just now'
  const diffMins = Math.round(diffMs / 60000)
  if (diffMins < 1) return 'in <1 min'
  if (diffMins === 1) return 'in 1 min'
  if (diffMins < 60) return `in ${diffMins} mins`
  const diffHours = Math.floor(diffMins / 60)
  const remainingMins = diffMins % 60
  if (diffHours < 24) {
    return remainingMins > 0 ? `in ${diffHours}h ${remainingMins}m` : `in ${diffHours}h`
  }
  const diffDays = Math.floor(diffHours / 24)
  return diffDays === 1 ? 'tomorrow' : `in ${diffDays} days`
}

/**
 * Calculates upcoming scheduled execution dates for a 5-field cron expression in a specific timezone
 */
export function getNextCronExecutions(expression, timezone = 'Asia/Kolkata', count = 5) {
  if (!isValidCron(expression)) return []

  const parts = expression.trim().split(/\s+/)
  const minSet = parseCronField(parts[0], 0, 59)
  const hourSet = parseCronField(parts[1], 0, 23)
  const domSet = parseCronField(parts[2], 1, 31)
  const monthSet = parseCronField(parts[3], 1, 12)
  const dowSet = parseCronField(parts[4], 0, 7)

  if (!minSet || !hourSet || !domSet || !monthSet || !dowSet) return []
  if (dowSet.has(7)) dowSet.add(0)
  if (dowSet.has(0)) dowSet.add(7)

  const isDomWildcard = parts[2].trim() === '*'
  const isDowWildcard = parts[4].trim() === '*'

  const results = []
  const now = new Date()
  // Start from next whole minute
  let cursor = new Date(Math.floor((now.getTime() + 60000) / 60000) * 60000)

  let dtf
  try {
    dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return []
  }

  // Iterate forward with smart skips up to max ~10,000 checks
  let iterations = 0
  const maxIterations = 8000

  while (results.length < count && iterations < maxIterations) {
    iterations++
    const tzParts = getTzParts(cursor, timezone)
    if (!tzParts) break

    // Check month
    if (!monthSet.has(tzParts.month)) {
      cursor = new Date(cursor.getTime() + 24 * 3600000)
      continue
    }

    // Check day (dom & dow)
    let dayMatches = false
    if (isDomWildcard && isDowWildcard) {
      dayMatches = true
    } else if (isDomWildcard) {
      dayMatches = dowSet.has(tzParts.weekday)
    } else if (isDowWildcard) {
      dayMatches = domSet.has(tzParts.day)
    } else {
      dayMatches = domSet.has(tzParts.day) || dowSet.has(tzParts.weekday)
    }

    if (!dayMatches) {
      // Advance to next day (or next 12 hours) to accelerate search
      cursor = new Date(cursor.getTime() + 12 * 3600000)
      continue
    }

    // Check hour
    if (!hourSet.has(tzParts.hour)) {
      // Advance to next hour
      cursor = new Date(cursor.getTime() + 3600000)
      continue
    }

    // Check minute
    if (minSet.has(tzParts.minute)) {
      results.push({
        date: new Date(cursor),
        formatted: dtf.format(cursor),
        relative: formatRelativeTime(cursor, now),
        timestamp: cursor.getTime(),
      })
    }

    // Advance 1 minute
    cursor = new Date(cursor.getTime() + 60000)
  }

  return results
}

// Converts form configuration (minutes, hours, daily, weekly, monthly, or cron) into a 5-field cron string
export function computeCronFromConfig(form) {
  const type = form.scheduleType || 'minutes'

  if (type === 'minutes') {
    const mins = Math.max(1, Math.min(59, parseInt(form.intervalMinutes || 5, 10)))
    return mins === 1 ? '* * * * *' : `*/${mins} * * * *`
  }

  if (type === 'hours') {
    const hrs = Math.max(1, Math.min(23, parseInt(form.intervalHours || 1, 10)))
    const min = Math.max(0, Math.min(59, parseInt(form.intervalMinuteOfHour || 0, 10)))
    return hrs === 1 ? `${min} * * * *` : `${min} */${hrs} * * *`
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

  if (type === 'monthly') {
    const time = form.monthlyTime || '09:00'
    const [h, m] = time.split(':').map((v) => parseInt(v, 10) || 0)
    const day = Math.max(1, Math.min(31, parseInt(form.monthlyDay || 1, 10)))
    return `${m} ${h} ${day} * *`
  }

  if (type === 'cron') {
    return (form.cronExpression || form.schedule || '*/5 * * * *').trim()
  }

  return '*/5 * * * *'
}

// Generates an English human-readable description from the schedule settings
export function computeScheduleSummary(form, cronExpr) {
  const type = form.scheduleType || 'minutes'
  const tz = form.timezone || 'Asia/Kolkata'

  const formatTime12 = (timeStr = '09:00') => {
    const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10) || 0)
    const period = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${period}`
  }

  if (type === 'minutes') {
    const mins = parseInt(form.intervalMinutes || 5, 10)
    return mins === 1 ? `Every minute (${tz})` : `Every ${mins} minutes (${tz})`
  }

  if (type === 'hours') {
    const hrs = parseInt(form.intervalHours || 1, 10)
    const min = String(form.intervalMinuteOfHour || 0).padStart(2, '0')
    return hrs === 1
      ? `Every hour at :${min} past the hour (${tz})`
      : `Every ${hrs} hours at :${min} past the hour (${tz})`
  }

  if (type === 'daily') {
    return `Daily at ${formatTime12(form.dailyTime || '09:00')} (${tz})`
  }

  if (type === 'weekly') {
    const dayLabels = {
      '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat', '0': 'Sun', '7': 'Sun',
    }
    const days = (form.weeklyDays || ['1', '2', '3', '4', '5'])
      .map((d) => dayLabels[d] || d)
      .join(', ')
    return `Weekly on [${days}] at ${formatTime12(form.weeklyTime || '09:00')} (${tz})`
  }

  if (type === 'monthly') {
    const day = parseInt(form.monthlyDay || 1, 10)
    const suffix = ['th', 'st', 'nd', 'rd'][(day % 100 > 10 && day % 100 < 20) ? 0 : (day % 10 < 4 ? day % 10 : 0)] || 'th'
    return `Monthly on the ${day}${suffix} at ${formatTime12(form.monthlyTime || '09:00')} (${tz})`
  }

  return `Custom schedule: ${cronExpr} (${tz})`
}

const scheduleTriggerConfig = {
  label: 'Cron & Schedule Trigger',
  description: 'Start workflows automatically on intervals, daily, weekly, or custom Cron schedules.',
  defaults: {
    scheduleType: 'minutes',
    intervalMinutes: 5,
    intervalHours: 1,
    intervalMinuteOfHour: 0,
    dailyTime: '09:00',
    weeklyDays: ['1', '2', '3', '4', '5'],
    weeklyTime: '09:00',
    monthlyDay: 1,
    monthlyTime: '09:00',
    cronExpression: '*/5 * * * *',
    schedule: '*/5 * * * *',
    timezone: 'Asia/Kolkata',
    enabled: true,
    summary: 'Every 5 minutes (Asia/Kolkata)',
  },
  fields: [
    { key: 'scheduleType', label: 'Schedule Type', type: 'select', defaultValue: 'minutes' },
    { key: 'cronExpression', label: 'Cron Expression', type: 'text', defaultValue: '*/5 * * * *', required: true },
    { key: 'schedule', label: 'Schedule', type: 'text', defaultValue: '*/5 * * * *' },
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
