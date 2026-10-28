import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  Check,
  Clock,
  Copy,
  Globe,
  Hourglass,
  Info,
  LoaderCircle,
  Play,
  RefreshCw,
  Sun,
  Terminal,
  Zap,
} from 'lucide-react'
import {
  computeCronFromConfig,
  computeScheduleSummary,
  getNextCronExecutions,
  isValidCron,
} from './nodeConfig.js'
import {
  registerScheduleApi,
  runScheduleNowApi,
  validateCronApi,
} from '../../services/api.js'

const POPULAR_TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST · UTC+5:30)' },
  { value: 'UTC', label: 'UTC (Universal Coordinated Time)' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT · UTC-5)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT · UTC-6)' },
  { value: 'America/Denver', label: 'America/Denver (MST/MDT · UTC-7)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT · UTC-8)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST · UTC+0/+1)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST · UTC+1/+2)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST · UTC+1/+2)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST · UTC+4)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT · UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST · UTC+9)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT · UTC+10/+11)' },
]

const WEEKDAYS = [
  { id: '1', label: 'Mon', full: 'Monday' },
  { id: '2', label: 'Tue', full: 'Tuesday' },
  { id: '3', label: 'Wed', full: 'Wednesday' },
  { id: '4', label: 'Thu', full: 'Thursday' },
  { id: '5', label: 'Fri', full: 'Friday' },
  { id: '6', label: 'Sat', full: 'Saturday' },
  { id: '0', label: 'Sun', full: 'Sunday' },
]

const FREQUENCY_MODES = [
  { id: 'minutes', label: 'Minutes', icon: Zap, desc: 'Every N mins' },
  { id: 'hours', label: 'Hourly', icon: Hourglass, desc: 'Every N hrs' },
  { id: 'daily', label: 'Daily', icon: Sun, desc: 'Once a day' },
  { id: 'weekly', label: 'Weekly', icon: Calendar, desc: 'Specific days' },
  { id: 'monthly', label: 'Monthly', icon: CalendarDays, desc: 'Once a month' },
  { id: 'cron', label: 'Custom Cron', icon: Terminal, desc: '5-field syntax' },
]

export default function ScheduleConfigForm({
  value = {},
  errors = {},
  onChange,
  workflowId: propWorkflowId,
  nodeId: propNodeId,
}) {
  const [copied, setCopied] = useState(false)
  const [syncStatus, setSyncStatus] = useState(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [backendFeedback, setBackendFeedback] = useState('')
  const [customTzActive, setCustomTzActive] = useState(false)
  const [currentTimeStr, setCurrentTimeStr] = useState('')

  const detectedBrowserTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
    } catch {
      return 'Asia/Kolkata'
    }
  }, [])

  const scheduleType = value.scheduleType || 'minutes'
  const timezone = value.timezone || detectedBrowserTz || 'Asia/Kolkata'
  const enabled = value.enabled !== undefined ? Boolean(value.enabled) : true

  // Auto-set detected timezone if not explicitly provided
  useEffect(() => {
    if (!value.timezone && detectedBrowserTz) {
      onChange({
        ...value,
        timezone: detectedBrowserTz,
      })
    }
  }, [detectedBrowserTz])

  // Current cron string
  const currentCron = scheduleType === 'cron'
    ? (value.cronExpression || value.schedule || '*/5 * * * *')
    : computeCronFromConfig(value)

  const isCurrentCronValid = isValidCron(currentCron)
  const humanSummary = computeScheduleSummary(value, currentCron)

  // Live calculation of next 5 execution timestamps
  const upcomingExecutions = useMemo(() => {
    if (!isCurrentCronValid) return []
    return getNextCronExecutions(currentCron, timezone, 5)
  }, [currentCron, timezone, isCurrentCronValid])

  // Live clock updater for target timezone
  useEffect(() => {
    const updateTime = () => {
      try {
        const str = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZoneName: 'short',
        }).format(new Date())
        setCurrentTimeStr(str)
      } catch {
        setCurrentTimeStr('')
      }
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [timezone])

  // Central setter: updates both schedule & cronExpression for full backend compatibility
  const setField = (field, nextVal) => {
    const updated = { ...value, [field]: nextVal }
    const nextCron = (field === 'cronExpression' || field === 'schedule') && updated.scheduleType === 'cron'
      ? nextVal
      : computeCronFromConfig(updated)
    const nextSummary = computeScheduleSummary(updated, nextCron)

    onChange({
      ...updated,
      cronExpression: nextCron,
      schedule: nextCron,
      summary: nextSummary,
    })
  }

  // Switch frequency mode
  const setMode = (modeId) => {
    const updated = { ...value, scheduleType: modeId }
    const nextCron = computeCronFromConfig(updated)
    const nextSummary = computeScheduleSummary(updated, nextCron)
    onChange({
      ...updated,
      cronExpression: nextCron,
      schedule: nextCron,
      summary: nextSummary,
    })
  }

  // Detect and apply local browser timezone
  const handleDetectLocalTimezone = () => {
    try {
      const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (localTz) {
        setField('timezone', localTz)
      }
    } catch (err) {
      console.warn('Could not detect timezone:', err)
    }
  }

  // Copy cron expression to clipboard
  const handleCopyCron = () => {
    navigator.clipboard.writeText(currentCron)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  // Toggle day of week for weekly schedule
  const toggleWeekday = (dayId) => {
    const currentDays = Array.isArray(value.weeklyDays) ? [...value.weeklyDays] : ['1', '2', '3', '4', '5']
    const nextDays = currentDays.includes(dayId)
      ? currentDays.filter((d) => d !== dayId)
      : [...currentDays, dayId]

    if (nextDays.length === 0) return
    setField('weeklyDays', nextDays)
  }

  // Apply minute presets
  const applyMinutePreset = (mins) => {
    const updated = { ...value, scheduleType: 'minutes', intervalMinutes: mins }
    const cron = mins === 1 ? '* * * * *' : `*/${mins} * * * *`
    onChange({
      ...updated,
      cronExpression: cron,
      schedule: cron,
      summary: computeScheduleSummary(updated, cron),
    })
  }

  // Apply daily presets
  const applyDailyPreset = (time) => {
    const updated = { ...value, scheduleType: 'daily', dailyTime: time }
    const [h, m] = time.split(':').map((v) => parseInt(v, 10) || 0)
    const cron = `${m} ${h} * * *`
    onChange({
      ...updated,
      cronExpression: cron,
      schedule: cron,
      summary: computeScheduleSummary(updated, cron),
    })
  }

  // Apply custom cron presets
  const applyCustomCronPreset = (cron) => {
    const updated = { ...value, scheduleType: 'cron', cronExpression: cron, schedule: cron }
    onChange({
      ...updated,
      summary: computeScheduleSummary(updated, cron),
    })
  }

  // Test Run Now
  const handleTestRunNow = async () => {
    setIsTesting(true)
    setBackendFeedback('')
    try {
      const targetWfId = propWorkflowId || value._workflowId || 'wf_canvas_active'
      const targetTriggerNodeId = propNodeId || value._nodeId || 'scheduleTrigger'
      const scheduleId = syncStatus?.scheduleId || `sched_${targetWfId}_${targetTriggerNodeId}`

      const regRes = await registerScheduleApi({
        id: scheduleId,
        workflowId: targetWfId,
        triggerNodeId: targetTriggerNodeId,
        cronExpression: currentCron,
        timezone,
        enabled: true,
        summary: humanSummary,
        scheduleType,
      })
      const finalSchedId = regRes.schedule?.id || scheduleId
      const testRes = await runScheduleNowApi(finalSchedId)
      setBackendFeedback(`Workflow triggered successfully! Execution ID: ${testRes.executionResult?.executionId || 'queued'}`)
    } catch (err) {
      console.error('Test run error:', err)
      setBackendFeedback(`Test run error: ${err.message}`)
    } finally {
      setIsTesting(false)
    }
  }

  // Register in server memory
  const handleRegisterOnBackend = async () => {
    setIsSyncing(true)
    setBackendFeedback('')
    try {
      const valRes = await validateCronApi(currentCron, timezone)
      if (!valRes.valid) {
        throw new Error(valRes.error || 'Server rejected cron expression.')
      }

      const targetWfId = propWorkflowId || value._workflowId || 'wf_canvas_active'
      const targetTriggerNodeId = propNodeId || value._nodeId || 'scheduleTrigger'
      const scheduleId = `sched_${targetWfId}_${targetTriggerNodeId}`

      const result = await registerScheduleApi({
        id: scheduleId,
        workflowId: targetWfId,
        triggerNodeId: targetTriggerNodeId,
        cronExpression: currentCron,
        timezone,
        enabled,
        summary: humanSummary,
        scheduleType,
      })

      setSyncStatus({
        registered: true,
        scheduleId: result.schedule?.id,
        enabled: result.schedule?.enabled,
        time: new Date().toLocaleTimeString(),
      })
      setBackendFeedback(`Registered in backend scheduler with expression "${currentCron}".`)
    } catch (err) {
      console.error('Registration failed:', err)
      setBackendFeedback(`Sync error: ${err.message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  // Cron 5-field breakdown values for visual indicator
  const cronFields = useMemo(() => {
    if (!isCurrentCronValid) return ['*', '*', '*', '*', '*']
    return currentCron.trim().split(/\s+/)
  }, [currentCron, isCurrentCronValid])

  return (
    <div className="space-y-5 text-[#e5d8b8]">
      {/* 1. Header with Active / Paused Status Toggle */}
      <div className="flex items-center justify-between rounded-xl border border-[#8e7139]/40 bg-gradient-to-r from-[#17120e] via-[#1f1710] to-[#17120e] p-3.5 shadow-md">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            enabled
              ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
              : 'bg-[#8e7139]/20 text-[#a9997b]'
          }`}>
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#f0e5c9]">Trigger Schedule</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                enabled
                  ? 'bg-emerald-950/70 text-emerald-300 ring-1 ring-emerald-500/30'
                  : 'bg-stone-900 text-stone-400'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'}`} />
                {enabled ? 'Active' : 'Paused'}
              </span>
            </div>
            <p className="text-[11px] text-[#9f927b]">
              {enabled ? 'Runs automatically on schedule' : 'Execution paused (will not trigger)'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setField('enabled', !enabled)}
          className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            enabled
              ? 'border border-amber-500/30 bg-amber-500/10 text-[#f0d58e] hover:bg-amber-500/20'
              : 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
          }`}
        >
          {enabled ? 'Pause' : 'Activate'}
        </button>
      </div>

      {/* 2. Frequency Tabs (Minutes, Hourly, Daily, Weekly, Monthly, Cron) */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#a9997b] mb-1.5">
          Select Frequency
        </label>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 rounded-xl border border-[#8e7139]/30 bg-[#100d0a] p-1.5">
          {FREQUENCY_MODES.map((mode) => {
            const Icon = mode.icon
            const isActive = scheduleType === mode.id
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setMode(mode.id)}
                className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg py-2 px-1 text-center transition ${
                  isActive
                    ? 'border border-[#d4ad58]/60 bg-[#c69b45] text-[#21170c] font-bold shadow-md'
                    : 'text-[#c9b991] hover:bg-white/5 hover:text-[#f0e5c9]'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-[#21170c]' : 'text-[#d4ad58]'}`} />
                <span className="text-[11px] leading-none">{mode.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Frequency-Specific Visual Builder */}
      <div className="rounded-xl border border-[#8e7139]/35 bg-[#14100c] p-4 space-y-4">
        {/* Minutes Mode */}
        {scheduleType === 'minutes' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-[#f0e5c9]">Run Every N Minutes</h4>
                <p className="text-[11px] text-[#9f927b]">Ideal for high-frequency polling and health checks</p>
              </div>
              <span className="text-xs font-mono font-bold text-[#f0d58e] bg-[#221a12] px-2.5 py-1 rounded border border-[#8e7139]/30">
                */{value.intervalMinutes ?? 5} * * * *
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="59"
                  value={value.intervalMinutes ?? 5}
                  onChange={(e) => setField('intervalMinutes', Math.max(1, Math.min(59, parseInt(e.target.value, 10) || 1)))}
                  className="w-24 rounded-lg border border-[#8e7139]/45 bg-[#100d0a] px-3 py-2 text-center text-base font-bold text-[#f0d58e] outline-none focus:border-[#d4ad58]"
                />
              </div>
              <span className="text-xs font-medium text-[#dec69e]">minutes</span>
            </div>

            {/* Presets */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#9f927b] mb-1.5">Quick Presets</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Every 1 min (Test)', val: 1 },
                  { label: 'Every 5 mins', val: 5 },
                  { label: 'Every 10 mins', val: 10 },
                  { label: 'Every 15 mins', val: 15 },
                  { label: 'Every 30 mins', val: 30 },
                  { label: 'Every 45 mins', val: 45 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => applyMinutePreset(preset.val)}
                    className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                      parseInt(value.intervalMinutes ?? 5, 10) === preset.val
                        ? 'border-[#d4ad58] bg-[#d4ad58]/25 text-[#f0d58e]'
                        : 'border-[#8e7139]/30 bg-[#1c1611] text-[#b8a98c] hover:border-[#8e7139] hover:text-[#f0e5c9]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Hourly Mode */}
        {scheduleType === 'hours' && (
          <div className="space-y-3.5">
            <div>
              <h4 className="text-xs font-semibold text-[#f0e5c9]">Run Every N Hours</h4>
              <p className="text-[11px] text-[#9f927b]">Specify how many hours between executions and the minute offset</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-[#9f927b] block mb-1">
                  Every N Hours (1 - 24)
                </label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={value.intervalHours ?? 1}
                  onChange={(e) => setField('intervalHours', Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 1)))}
                  className="w-full rounded-lg border border-[#8e7139]/45 bg-[#100d0a] px-3 py-2 text-sm font-bold text-[#f0d58e] outline-none focus:border-[#d4ad58]"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-[#9f927b] block mb-1">
                  At Minute (00 - 59)
                </label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={value.intervalMinuteOfHour ?? 0}
                  onChange={(e) => setField('intervalMinuteOfHour', Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                  className="w-full rounded-lg border border-[#8e7139]/45 bg-[#100d0a] px-3 py-2 text-sm font-bold text-[#f0d58e] outline-none focus:border-[#d4ad58]"
                />
              </div>
            </div>

            {/* Presets */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#9f927b] mb-1.5">Common Hourly Schedules</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Every hour (:00)', hrs: 1, min: 0 },
                  { label: 'Every hour (:30)', hrs: 1, min: 30 },
                  { label: 'Every 2 hours', hrs: 2, min: 0 },
                  { label: 'Every 6 hours', hrs: 6, min: 0 },
                  { label: 'Every 12 hours', hrs: 12, min: 0 },
                ].map((preset) => {
                  const isSel = (value.intervalHours ?? 1) === preset.hrs && (value.intervalMinuteOfHour ?? 0) === preset.min
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setField('intervalHours', preset.hrs)
                        setField('intervalMinuteOfHour', preset.min)
                      }}
                      className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                        isSel
                          ? 'border-[#d4ad58] bg-[#d4ad58]/25 text-[#f0d58e]'
                          : 'border-[#8e7139]/30 bg-[#1c1611] text-[#b8a98c] hover:border-[#8e7139] hover:text-[#f0e5c9]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Daily Mode */}
        {scheduleType === 'daily' && (
          <div className="space-y-3.5">
            <div>
              <h4 className="text-xs font-semibold text-[#f0e5c9]">Trigger Daily At Specific Time</h4>
              <p className="text-[11px] text-[#9f927b]">Fires once every 24 hours at the exact time in selected timezone</p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="time"
                value={value.dailyTime || '09:00'}
                onChange={(e) => setField('dailyTime', e.target.value)}
                className="rounded-lg border border-[#8e7139]/45 bg-[#100d0a] px-3.5 py-2.5 text-base font-bold text-[#f0d58e] outline-none focus:border-[#d4ad58]"
              />
              <span className="text-xs text-[#dec69e]">in configured timezone</span>
            </div>

            {/* Presets */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#9f927b] mb-1.5">Quick Time Presets</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Morning (09:00)', val: '09:00' },
                  { label: 'Noon (12:00)', val: '12:00' },
                  { label: 'Afternoon (15:00)', val: '15:00' },
                  { label: 'Evening (18:00)', val: '18:00' },
                  { label: 'Night (22:00)', val: '22:00' },
                  { label: 'Midnight (00:00)', val: '00:00' },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => applyDailyPreset(preset.val)}
                    className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                      (value.dailyTime || '09:00') === preset.val
                        ? 'border-[#d4ad58] bg-[#d4ad58]/25 text-[#f0d58e]'
                        : 'border-[#8e7139]/30 bg-[#1c1611] text-[#b8a98c] hover:border-[#8e7139] hover:text-[#f0e5c9]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Weekly Mode */}
        {scheduleType === 'weekly' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-[#f0e5c9]">Select Days of the Week</h4>
                <div className="flex items-center gap-2 text-[10px] text-[#a9997b]">
                  <button
                    type="button"
                    onClick={() => setField('weeklyDays', ['1', '2', '3', '4', '5'])}
                    className="hover:text-[#f0d58e] underline underline-offset-2"
                  >
                    Weekdays
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setField('weeklyDays', ['6', '0'])}
                    className="hover:text-[#f0d58e] underline underline-offset-2"
                  >
                    Weekends
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setField('weeklyDays', ['1', '2', '3', '4', '5', '6', '0'])}
                    className="hover:text-[#f0d58e] underline underline-offset-2"
                  >
                    All Days
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAYS.map((day) => {
                  const selected = Array.isArray(value.weeklyDays) && value.weeklyDays.includes(day.id)
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleWeekday(day.id)}
                      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg py-2 transition ${
                        selected
                          ? 'border border-[#d4ad58] bg-[#c69b45] text-[#21170c] font-bold shadow'
                          : 'border border-[#8e7139]/30 bg-[#100d0a] text-[#a9997b] hover:text-[#f0e5c9] hover:border-[#8e7139]'
                      }`}
                    >
                      <span className="text-xs font-semibold">{day.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#9f927b] mb-1">
                Execution Time (HH:MM)
              </label>
              <input
                type="time"
                value={value.weeklyTime || '09:00'}
                onChange={(e) => setField('weeklyTime', e.target.value)}
                className="rounded-lg border border-[#8e7139]/45 bg-[#100d0a] px-3.5 py-2 text-sm font-bold text-[#f0d58e] outline-none focus:border-[#d4ad58]"
              />
            </div>
          </div>
        )}

        {/* Monthly Mode */}
        {scheduleType === 'monthly' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-[#f0e5c9]">Trigger Monthly On Specific Day</h4>
              <p className="text-[11px] text-[#9f927b]">Runs on a designated day of each month</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-[#9f927b] block mb-1">
                  Day of Month (1 - 31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={value.monthlyDay ?? 1}
                  onChange={(e) => setField('monthlyDay', Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1)))}
                  className="w-full rounded-lg border border-[#8e7139]/45 bg-[#100d0a] px-3 py-2 text-sm font-bold text-[#f0d58e] outline-none focus:border-[#d4ad58]"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-[#9f927b] block mb-1">
                  Execution Time
                </label>
                <input
                  type="time"
                  value={value.monthlyTime || '09:00'}
                  onChange={(e) => setField('monthlyTime', e.target.value)}
                  className="w-full rounded-lg border border-[#8e7139]/45 bg-[#100d0a] px-3 py-2 text-sm font-bold text-[#f0d58e] outline-none focus:border-[#d4ad58]"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#9f927b] mb-1.5">Monthly Presets</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '1st of Month (09:00)', day: 1, time: '09:00' },
                  { label: '15th of Month (12:00)', day: 15, time: '12:00' },
                  { label: 'End of Month (28th)', day: 28, time: '18:00' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setField('monthlyDay', preset.day)
                      setField('monthlyTime', preset.time)
                    }}
                    className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                      (value.monthlyDay ?? 1) === preset.day
                        ? 'border-[#d4ad58] bg-[#d4ad58]/25 text-[#f0d58e]'
                        : 'border-[#8e7139]/30 bg-[#1c1611] text-[#b8a98c] hover:border-[#8e7139] hover:text-[#f0e5c9]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Custom Cron Mode with Interactive 5-Field Explainer */}
        {scheduleType === 'cron' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-[#f0e5c9]">5-Field Cron Expression</h4>
                <p className="text-[11px] text-[#9f927b]">Full UNIX cron power with minute, hour, day, month, and weekday</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                isCurrentCronValid
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
              }`}>
                {isCurrentCronValid ? 'Valid Syntax' : 'Invalid Syntax'}
              </span>
            </div>

            <input
              type="text"
              value={value.cronExpression || value.schedule || ''}
              onChange={(e) => setField('cronExpression', e.target.value)}
              placeholder="*/5 * * * *"
              className="w-full font-mono rounded-lg border border-[#8e7139]/45 bg-[#100d0a] px-3.5 py-2.5 text-base font-bold tracking-wider text-[#f0d58e] outline-none focus:border-[#d4ad58]"
            />

            {/* Interactive 5-Field Breakdown Cards */}
            <div className="grid grid-cols-5 gap-1.5 text-center">
              {[
                { title: 'MIN', range: '0-59', val: cronFields[0] || '*' },
                { title: 'HOUR', range: '0-23', val: cronFields[1] || '*' },
                { title: 'DOM', range: '1-31', val: cronFields[2] || '*' },
                { title: 'MONTH', range: '1-12', val: cronFields[3] || '*' },
                { title: 'DOW', range: '0-7', val: cronFields[4] || '*' },
              ].map((f) => (
                <div key={f.title} className="rounded-lg border border-[#8e7139]/30 bg-[#100d0a] p-2">
                  <span className="block text-[9px] uppercase font-bold tracking-wider text-[#a9997b]">
                    {f.title}
                  </span>
                  <span className="block font-mono text-xs font-bold text-[#f0d58e] truncate my-0.5">
                    {f.val}
                  </span>
                  <span className="block text-[9px] text-[#6b604e]">{f.range}</span>
                </div>
              ))}
            </div>

            {/* Popular Cron Presets */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#9f927b] mb-1.5">Common Cron Examples</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Every 5 mins', cron: '*/5 * * * *' },
                  { label: 'Hourly (:00)', cron: '0 * * * *' },
                  { label: 'Workdays 09:00', cron: '0 9 * * 1-5' },
                  { label: 'Nightly 02:30', cron: '30 2 * * *' },
                  { label: 'Midnight Daily', cron: '0 0 * * *' },
                  { label: 'Weekly (Sun 00:00)', cron: '0 0 * * 0' },
                ].map((preset) => (
                  <button
                    key={preset.cron}
                    type="button"
                    onClick={() => applyCustomCronPreset(preset.cron)}
                    className="rounded-md border border-[#8e7139]/30 bg-[#1c1611] px-2.5 py-1 text-[11px] text-[#c9b991] transition hover:border-[#d4ad58] hover:text-[#f0d58e]"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Timezone Selector with Live Current Time */}
      <div className="rounded-xl border border-[#8e7139]/35 bg-[#14100c] p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[#f0e5c9] flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-[#d4ad58]" />
            Timezone
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDetectLocalTimezone}
              className="text-[11px] text-[#d4ad58] hover:underline"
            >
              Detect My Timezone
            </button>
            <span className="text-[#8e7139]">·</span>
            <button
              type="button"
              onClick={() => setCustomTzActive(!customTzActive)}
              className="text-[11px] text-[#c69b45] hover:underline"
            >
              {customTzActive ? 'Pick from list' : 'Custom IANA'}
            </button>
          </div>
        </div>

        {customTzActive ? (
          <input
            type="text"
            value={timezone}
            onChange={(e) => setField('timezone', e.target.value.trim())}
            placeholder="e.g. Asia/Kolkata, America/New_York, Europe/London"
            className="w-full rounded-lg border border-[#8e7139]/45 bg-[#100d0a] px-3 py-2 text-xs text-[#f0e5c9] outline-none focus:border-[#d4ad58]"
          />
        ) : (
          <select
            value={timezone}
            onChange={(e) => setField('timezone', e.target.value)}
            className="w-full rounded-lg border border-[#8e7139]/45 bg-[#100d0a] px-3 py-2 text-xs text-[#f0e5c9] outline-none focus:border-[#d4ad58]"
          >
            {POPULAR_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value} className="bg-[#17120e]">
                {tz.label}
              </option>
            ))}
          </select>
        )}

        {currentTimeStr && (
          <p className="text-[11px] text-[#9f927b] flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-[#d4ad58]" />
            Current time in {timezone}: <strong className="text-[#f0d58e]">{currentTimeStr}</strong>
          </p>
        )}

        {detectedBrowserTz && timezone !== detectedBrowserTz && (
          <div className="rounded-lg border border-amber-500/35 bg-amber-950/30 p-2.5 text-[11px] text-amber-200 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-amber-300">
              <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>Timezone difference detected</span>
            </div>
            <p className="text-[11px] text-amber-200/90 leading-relaxed">
              Your local device timezone is <strong>{detectedBrowserTz}</strong>, but schedule is set in <strong>{timezone}</strong>.
            </p>
            <button
              type="button"
              onClick={() => setField('timezone', detectedBrowserTz)}
              className="inline-flex items-center gap-1 mt-0.5 text-[11px] text-[#f0d58e] underline hover:text-white cursor-pointer font-medium"
            >
              Switch schedule to your local timezone ({detectedBrowserTz})
            </button>
          </div>
        )}
      </div>

      {/* 5. Live English Summary & Cron Tag */}
      <div className="rounded-xl border border-[#8e7139]/40 bg-[#100d0a] p-3.5 space-y-2.5 shadow-inner">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a9997b]">
            Schedule Overview
          </span>
          <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${
            isCurrentCronValid
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
          }`}>
            {isCurrentCronValid ? (
              <><Check className="h-3 w-3" /> Valid</>
            ) : (
              <><AlertCircle className="h-3 w-3" /> Invalid</>
            )}
          </span>
        </div>

        <p className="text-sm font-semibold text-[#f0d58e] leading-snug">
          {humanSummary}
        </p>

        <div className="flex items-center justify-between rounded-lg bg-[#17120e] px-3 py-2 border border-[#8e7139]/30">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] uppercase font-bold text-[#8e7139]">Cron:</span>
            <code className="text-xs font-mono font-bold text-[#e5d8b8] tracking-widest truncate">
              {currentCron}
            </code>
          </div>
          <button
            type="button"
            onClick={handleCopyCron}
            className="flex cursor-pointer items-center gap-1 text-[11px] text-[#a9997b] transition hover:text-[#f0d58e] shrink-0"
            title="Copy cron expression"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* 6. Upcoming 5 Executions Timeline (Game-changer for user confidence) */}
      {upcomingExecutions.length > 0 && (
        <div className="rounded-xl border border-[#8e7139]/35 bg-[#14100c] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-[#f0e5c9] flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#d4ad58]" />
              Upcoming Scheduled Runs
            </h4>
            <span className="text-[10px] text-[#9f927b]">Next 5 executions</span>
          </div>

          <div className="space-y-1.5">
            {upcomingExecutions.map((run, idx) => (
              <div
                key={run.timestamp}
                className="flex items-center justify-between rounded-lg bg-[#100d0a] px-3 py-1.5 border border-[#8e7139]/20 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                    idx === 0 ? 'bg-[#c69b45] text-[#21170c]' : 'bg-[#251e15] text-[#a9997b]'
                  }`}>
                    {idx + 1}
                  </span>
                  <span className="font-medium text-[#f0e5c9]">{run.formatted}</span>
                </div>
                <span className={`text-[11px] font-semibold ${
                  idx === 0 ? 'text-[#f0d58e]' : 'text-[#8e7139]'
                }`}>
                  {run.relative}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Action Controls: Test Run Now & Server Memory Registration */}
      <div className="rounded-xl border border-[#8e7139]/35 bg-[#17120e] p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-[#f0e5c9] flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-[#d4ad58]" />
              Trigger Actions
            </h4>
            <p className="text-[11px] text-[#9f927b]">
              Test execution immediately or sync with the running backend scheduler
            </p>
          </div>
          {syncStatus?.registered && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 text-[10px] text-emerald-300 font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Synced in Memory
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleTestRunNow}
            disabled={isTesting}
            title="Immediately trigger workflow execution starting at this Schedule Trigger"
            className="flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#c69b45]/50 bg-[#c69b45]/20 px-3.5 py-2.5 text-xs font-bold text-[#f0d58e] transition hover:bg-[#c69b45]/30 hover:border-[#c69b45] disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
          >
            {isTesting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 text-[#d4ad58] fill-current" />
            )}
            Test Run Now
          </button>

          <button
            type="button"
            onClick={handleRegisterOnBackend}
            disabled={isSyncing || !isCurrentCronValid}
            className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#8e7139]/50 bg-[#251e15] px-3.5 py-2.5 text-xs font-medium text-[#f0d58e] shadow transition hover:bg-[#342718] hover:border-[#d4ad58] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSyncing ? (
              <LoaderCircle className="h-4 w-4 animate-spin text-[#d4ad58]" />
            ) : (
              <RefreshCw className="h-4 w-4 text-[#d4ad58]" />
            )}
            Sync Scheduler
          </button>
        </div>

        {backendFeedback && (
          <div className="rounded-lg border border-[#8e7139]/35 bg-[#100d0a] p-2.5 text-[11px] text-[#dec69e] flex items-start gap-2">
            <Info className="h-3.5 w-3.5 text-[#d4ad58] shrink-0 mt-0.5" />
            <span>{backendFeedback}</span>
          </div>
        )}
      </div>

      {/* 8. Help Note */}
      <div className="flex items-start gap-2 rounded-lg border border-[#8e7139]/25 bg-[#120d09]/70 p-3 text-[11px] text-[#9f927b]">
        <Info className="h-3.5 w-3.5 shrink-0 text-[#a9997b] mt-0.5" />
        <p>
          <strong className="text-[#dec69e]">How schedules execute:</strong> When active, this trigger automatically initiates the workflow and executes downstream connected nodes on the specified cadence.
        </p>
      </div>
    </div>
  )
}
