import { useState } from 'react'
import {
  AlertCircle,
  Check,
  Clock,
  Copy,
  Info,
  LoaderCircle,
  Play,
  RefreshCw,
  Zap,
} from 'lucide-react'
import {
  computeCronFromConfig,
  computeScheduleSummary,
  isValidCron,
} from './nodeConfig.js'
import {
  registerScheduleApi,
  runScheduleNowApi,
  validateCronApi,
} from '../../services/api.js'

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST · UTC+5:30)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
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
  { id: '1', label: 'Mon' },
  { id: '2', label: 'Tue' },
  { id: '3', label: 'Wed' },
  { id: '4', label: 'Thu' },
  { id: '5', label: 'Fri' },
  { id: '6', label: 'Sat' },
  { id: '0', label: 'Sun' },
]

// Form component for configuring schedule triggers (minutes, hours, daily, weekly, cron)
export default function ScheduleConfigForm({ value, errors = {}, onChange }) {
  const [copied, setCopied] = useState(false)
  const [syncStatus, setSyncStatus] = useState(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [backendFeedback, setBackendFeedback] = useState('')
  const [customTzActive, setCustomTzActive] = useState(false)

  const scheduleType = value.scheduleType || 'minutes'
  const timezone = value.timezone || 'Asia/Kolkata'
  const enabled = value.enabled !== undefined ? Boolean(value.enabled) : true

  // Computed current cron expression
  const currentCron = scheduleType === 'cron'
    ? (value.cronExpression || '*/5 * * * *')
    : computeCronFromConfig(value)

  const isCurrentCronValid = isValidCron(currentCron)
  const humanSummary = computeScheduleSummary(value, currentCron)

  // Updates a form field and recalculates the corresponding cron expression and summary
  const setField = (field, nextValue) => {
    const updated = { ...value, [field]: nextValue }
    const nextCron = field === 'cronExpression' && updated.scheduleType === 'cron'
      ? nextValue
      : computeCronFromConfig(updated)
    const nextSummary = computeScheduleSummary(updated, nextCron)

    onChange({
      ...updated,
      cronExpression: nextCron,
      summary: nextSummary,
    })
  }

  // Copies the generated cron expression string to the clipboard
  const handleCopyCron = () => {
    navigator.clipboard.writeText(currentCron)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  // Toggles day-of-week selection for weekly recurring schedules
  const toggleWeekday = (dayId) => {
    const currentDays = Array.isArray(value.weeklyDays) ? [...value.weeklyDays] : ['1', '2', '3', '4', '5']
    const nextDays = currentDays.includes(dayId)
      ? currentDays.filter((d) => d !== dayId)
      : [...currentDays, dayId]

    if (nextDays.length === 0) return // Keep at least one
    setField('weeklyDays', nextDays)
  }

  // Applies a preset minute interval (e.g. 1 min, 5 min, 15 min)
  const setMinutePreset = (mins) => {
    onChange({
      ...value,
      scheduleType: 'minutes',
      intervalMinutes: mins,
      cronExpression: mins === 1 ? '* * * * *' : `*/${mins} * * * *`,
      summary: computeScheduleSummary({ ...value, scheduleType: 'minutes', intervalMinutes: mins }, mins === 1 ? '* * * * *' : `*/${mins} * * * *`),
    })
  }

  // Applies a preset time for daily execution
  const setDailyPreset = (time) => {
    const [h, m] = time.split(':')
    const cron = `${parseInt(m, 10)} ${parseInt(h, 10)} * * *`
    onChange({
      ...value,
      scheduleType: 'daily',
      dailyTime: time,
      cronExpression: cron,
      summary: computeScheduleSummary({ ...value, scheduleType: 'daily', dailyTime: time }, cron),
    })
  }

  // Registers the schedule with the backend in-memory cron runner
  const handleRegisterOnBackend = async () => {
    setIsSyncing(true)
    setBackendFeedback('')
    try {
      // Validate with server
      const valRes = await validateCronApi(currentCron, timezone)
      if (!valRes.valid) {
        throw new Error(valRes.error || 'Server rejected cron expression.')
      }

      // Read workflow context from window or fallback
      const workflowId = value._workflowId || 'wf_canvas_active'
      const triggerNodeId = value._nodeId || 'scheduleTrigger'

      const result = await registerScheduleApi({
        workflowId,
        triggerNodeId,
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
        summary: result.schedule?.summary,
        time: new Date().toLocaleTimeString(),
      })
      setBackendFeedback(`Schedule registered in backend memory! Active with cron "${currentCron}".`)
    } catch (err) {
      console.error('Failed to register schedule with backend:', err)
      setBackendFeedback(`Sync error: ${err.message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  // Triggers immediate execution of the workflow starting at this schedule trigger
  const handleTestRunNow = async () => {
    setIsTesting(true)
    setBackendFeedback('')
    try {
      const scheduleId = syncStatus?.scheduleId || (value._workflowId ? `sched_${value._workflowId}_${value._nodeId || 'scheduleTrigger'}` : null)

      if (!scheduleId) {
        // First register so schedule exists on backend
        const regRes = await registerScheduleApi({
          workflowId: value._workflowId || 'wf_canvas_active',
          triggerNodeId: value._nodeId || 'scheduleTrigger',
          cronExpression: currentCron,
          timezone,
          enabled: true,
          summary: humanSummary,
          scheduleType,
        })
        const newSchedId = regRes.schedule.id
        const testRes = await runScheduleNowApi(newSchedId)
        setBackendFeedback(`Workflow triggered successfully! Execution ID: ${testRes.executionResult?.executionId}`)
      } else {
        const testRes = await runScheduleNowApi(scheduleId)
        setBackendFeedback(`Workflow triggered successfully! Execution ID: ${testRes.executionResult?.executionId}`)
      }
    } catch (err) {
      console.error('Test run failed:', err)
      setBackendFeedback(`Test run failed: ${err.message}`)
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="space-y-6 text-[#e5d8b8]">
      {/* 1. Schedule Enable / Disable Status Header */}
      <div className="flex items-center justify-between rounded-lg border border-[#8e7139]/40 bg-[#120e0a] p-3.5 shadow-inner">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 items-center justify-center rounded-md ${enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[#8e7139]/20 text-[#a9997b]'}`}>
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#f0e5c9]">Trigger Status</span>
            <p className="text-[11px] text-[#9f927b]">
              {enabled ? 'Schedule will trigger automatically' : 'Schedule paused (will not trigger)'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setField('enabled', !enabled)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
            enabled
              ? 'border border-emerald-500/40 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60'
              : 'border border-[#8e7139]/40 bg-[#241c14] text-[#a9997b] hover:text-[#f0e5c9]'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${enabled ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'}`} />
          {enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {/* 2. Schedule Type Navigation Tabs */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#a9997b]">
          Schedule Frequency
        </label>
        <div className="mt-2 grid grid-cols-5 gap-1.5 rounded-lg border border-[#8e7139]/35 bg-[#100d0a] p-1 text-center text-xs">
          {[
            { id: 'minutes', label: 'Minutes' },
            { id: 'hours', label: 'Hours' },
            { id: 'daily', label: 'Daily' },
            { id: 'weekly', label: 'Weekly' },
            { id: 'cron', label: 'Cron' },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setField('scheduleType', mode.id)}
              className={`rounded py-1.5 font-medium transition ${
                scheduleType === mode.id
                  ? 'bg-[#c69b45] font-semibold text-[#21170c] shadow'
                  : 'text-[#c9b991] hover:bg-white/5 hover:text-[#f0e5c9]'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Frequency-Specific Configuration Form */}
      <div className="rounded-lg border border-[#8e7139]/30 bg-[#15110d] p-4 space-y-4">
        {/* Every N Minutes Mode */}
        {scheduleType === 'minutes' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#f0e5c9]">
                Trigger Every N Minutes
              </label>
              <span className="text-[11px] text-[#a9997b]">1 to 59 minutes</span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="59"
                value={value.intervalMinutes ?? 5}
                onChange={(e) => setField('intervalMinutes', Math.max(1, Math.min(59, parseInt(e.target.value, 10) || 1)))}
                className="w-24 rounded-md border border-[#8e7139]/45 bg-[#100d0a] px-3 py-2 text-center text-sm font-semibold text-[#f0d58e] outline-none focus:border-[#d4ad58]"
              />
              <span className="text-xs text-[#dec69e]">minutes</span>
            </div>

            {/* Presets */}
            <div className="pt-1">
              <p className="text-[10px] uppercase tracking-wider text-[#9f927b]">Quick Presets</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[
                  { label: 'Every 1 min (Test)', val: 1 },
                  { label: '5 min', val: 5 },
                  { label: '15 min', val: 15 },
                  { label: '30 min', val: 30 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setMinutePreset(preset.val)}
                    className={`rounded border px-2.5 py-1 text-[11px] transition ${
                      parseInt(value.intervalMinutes, 10) === preset.val
                        ? 'border-[#d4ad58] bg-[#d4ad58]/20 font-medium text-[#f0d58e]'
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

        {/* Every N Hours Mode */}
        {scheduleType === 'hours' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#f0e5c9]">
                Trigger Every N Hours
              </label>
              <span className="text-[11px] text-[#a9997b]">1 to 24 hours</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-[#9f927b]">Interval (hours)</label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={value.intervalHours ?? 1}
                  onChange={(e) => setField('intervalHours', Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 1)))}
                  className="mt-1 w-full rounded-md border border-[#8e7139]/45 bg-[#100d0a] px-3 py-2 text-sm text-[#f0d58e] outline-none focus:border-[#d4ad58]"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#9f927b]">At Minute (0-59)</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={value.intervalMinuteOfHour ?? 0}
                  onChange={(e) => setField('intervalMinuteOfHour', Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                  className="mt-1 w-full rounded-md border border-[#8e7139]/45 bg-[#100d0a] px-3 py-2 text-sm text-[#f0d58e] outline-none focus:border-[#d4ad58]"
                />
              </div>
            </div>

            {/* Presets */}
            <div className="pt-1">
              <p className="text-[10px] uppercase tracking-wider text-[#9f927b]">Quick Presets</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[
                  { label: 'Every 1 Hour', hrs: 1 },
                  { label: 'Every 2 Hours', hrs: 2 },
                  { label: 'Every 6 Hours', hrs: 6 },
                  { label: 'Every 12 Hours', hrs: 12 },
                ].map((preset) => (
                  <button
                    key={preset.hrs}
                    type="button"
                    onClick={() => {
                      setField('intervalHours', preset.hrs)
                      setField('intervalMinuteOfHour', 0)
                    }}
                    className={`rounded border px-2.5 py-1 text-[11px] transition ${
                      parseInt(value.intervalHours, 10) === preset.hrs && parseInt(value.intervalMinuteOfHour, 10) === 0
                        ? 'border-[#d4ad58] bg-[#d4ad58]/20 font-medium text-[#f0d58e]'
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

        {/* Daily Schedule Mode */}
        {scheduleType === 'daily' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#f0e5c9]">
                Trigger Daily at Time
              </label>
              <span className="text-[11px] text-[#a9997b]">24-Hour Time (HH:MM)</span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="time"
                value={value.dailyTime || '09:00'}
                onChange={(e) => setField('dailyTime', e.target.value)}
                className="rounded-md border border-[#8e7139]/45 bg-[#100d0a] px-3 py-2 text-sm font-semibold text-[#f0d58e] outline-none focus:border-[#d4ad58]"
              />
              <span className="text-xs text-[#dec69e]">every day in configured timezone</span>
            </div>

            {/* Presets */}
            <div className="pt-1">
              <p className="text-[10px] uppercase tracking-wider text-[#9f927b]">Time Presets</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[
                  { label: 'Morning (09:00)', val: '09:00' },
                  { label: 'Noon (12:00)', val: '12:00' },
                  { label: 'Evening (18:00)', val: '18:00' },
                  { label: 'Midnight (00:00)', val: '00:00' },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setDailyPreset(preset.val)}
                    className={`rounded border px-2.5 py-1 text-[11px] transition ${
                      value.dailyTime === preset.val
                        ? 'border-[#d4ad58] bg-[#d4ad58]/20 font-medium text-[#f0d58e]'
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

        {/* Weekly Schedule Mode */}
        {scheduleType === 'weekly' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-[#f0e5c9]">
                  Select Days of Week
                </label>
                <div className="flex items-center gap-1.5 text-[10px] text-[#a9997b]">
                  <button
                    type="button"
                    onClick={() => setField('weeklyDays', ['1', '2', '3', '4', '5'])}
                    className="hover:text-[#f0d58e]"
                  >
                    Weekdays
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setField('weeklyDays', ['1', '2', '3', '4', '5', '6', '0'])}
                    className="hover:text-[#f0d58e]"
                  >
                    All Days
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((day) => {
                  const selected = Array.isArray(value.weeklyDays) && value.weeklyDays.includes(day.id)
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleWeekday(day.id)}
                      className={`rounded py-2 text-xs font-semibold transition ${
                        selected
                          ? 'border border-[#d4ad58] bg-[#c69b45] text-[#21170c]'
                          : 'border border-[#8e7139]/30 bg-[#120e0a] text-[#a9997b] hover:text-[#f0e5c9]'
                      }`}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-[#9f927b] mb-1">
                Execution Time (HH:MM)
              </label>
              <input
                type="time"
                value={value.weeklyTime || '09:00'}
                onChange={(e) => setField('weeklyTime', e.target.value)}
                className="rounded-md border border-[#8e7139]/45 bg-[#100d0a] px-3 py-2 text-sm font-semibold text-[#f0d58e] outline-none focus:border-[#d4ad58]"
              />
            </div>
          </div>
        )}

        {/* Custom Cron Mode */}
        {scheduleType === 'cron' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#f0e5c9]">
                5-Field Cron Expression
              </label>
              <span className="text-[11px] text-[#a9997b]">min hr day mon dow</span>
            </div>

            <input
              type="text"
              value={value.cronExpression || ''}
              onChange={(e) => setField('cronExpression', e.target.value)}
              placeholder="*/5 * * * *"
              className="w-full font-mono rounded-md border border-[#8e7139]/45 bg-[#100d0a] px-3.5 py-2.5 text-sm font-semibold tracking-wider text-[#f0d58e] outline-none focus:border-[#d4ad58]"
            />

            {/* Field breakdown guide */}
            <div className="grid grid-cols-5 gap-1 text-[10px] text-center text-[#8e7139] border-t border-[#8e7139]/20 pt-2">
              <div><span className="block text-[#dec69e]">min</span>0-59</div>
              <div><span className="block text-[#dec69e]">hour</span>0-23</div>
              <div><span className="block text-[#dec69e]">day</span>1-31</div>
              <div><span className="block text-[#dec69e]">month</span>1-12</div>
              <div><span className="block text-[#dec69e]">dow</span>0-7</div>
            </div>

            {/* Presets */}
            <div className="pt-1">
              <p className="text-[10px] uppercase tracking-wider text-[#9f927b]">Popular Cron Examples</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[
                  { label: 'Every 1 min (Test)', cron: '*/1 * * * *' },
                  { label: 'Hourly at :00', cron: '0 * * * *' },
                  { label: 'Mon-Fri 09:00', cron: '0 9 * * 1-5' },
                  { label: 'Nightly 02:30', cron: '30 2 * * *' },
                ].map((preset) => (
                  <button
                    key={preset.cron}
                    type="button"
                    onClick={() => setField('cronExpression', preset.cron)}
                    className="rounded border border-[#8e7139]/30 bg-[#1c1611] px-2 py-1 text-[11px] text-[#c9b991] hover:border-[#d4ad58] hover:text-[#f0d58e]"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. IANA Time Zone Selection (Default: Asia/Kolkata) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[#f0e5c9] flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[#d4ad58]" />
            Time Zone (IANA)
          </label>
          <button
            type="button"
            onClick={() => setCustomTzActive(!customTzActive)}
            className="text-[11px] text-[#c69b45] hover:underline"
          >
            {customTzActive ? 'Choose from list' : 'Type custom timezone'}
          </button>
        </div>

        {customTzActive ? (
          <input
            type="text"
            value={timezone}
            onChange={(e) => setField('timezone', e.target.value.trim())}
            placeholder="e.g. Asia/Kolkata, America/New_York"
            className="w-full rounded-md border border-[#8e7139]/45 bg-[#100d0a] px-3 py-2 text-xs text-[#f0e5c9] outline-none focus:border-[#d4ad58]"
          />
        ) : (
          <select
            value={timezone}
            onChange={(e) => setField('timezone', e.target.value)}
            className="w-full rounded-md border border-[#8e7139]/45 bg-[#100d0a] px-3 py-2 text-xs text-[#f0e5c9] outline-none focus:border-[#d4ad58]"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value} className="bg-[#17120e]">
                {tz.label}
              </option>
            ))}
          </select>
        )}
        <p className="text-[10px] text-[#9f927b]">
          Defaulted to <strong className="text-[#f0d58e]">Asia/Kolkata</strong> (IST). Schedules fire based on this clock.
        </p>
      </div>

      {/* 5. Live Summary and Cron Expression Preview */}
      <div className="rounded-lg border border-[#8e7139]/45 bg-[#100d0a] p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a9997b]">
            Schedule Summary
          </span>
          <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${
            isCurrentCronValid
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
          }`}>
            {isCurrentCronValid ? (
              <><Check className="h-3 w-3" /> Valid Cron</>
            ) : (
              <><AlertCircle className="h-3 w-3" /> Invalid Cron</>
            )}
          </span>
        </div>

        <p className="text-xs font-medium text-[#f0d58e] leading-relaxed">
          {humanSummary}
        </p>

        <div className="flex items-center justify-between rounded bg-[#17120e] px-3 py-2 border border-[#8e7139]/25">
          <code className="text-xs font-mono text-[#e5d8b8] tracking-widest">
            {currentCron}
          </code>
          <button
            type="button"
            onClick={handleCopyCron}
            className="flex items-center gap-1 text-[11px] text-[#a9997b] transition hover:text-[#f0d58e]"
            title="Copy cron expression"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* 6. Backend In-Memory Schedule Synchronization Controls */}
      <div className="rounded-lg border border-[#8e7139]/35 bg-[#17120e] p-3.5 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-xs font-semibold text-[#f0e5c9] flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-[#d4ad58]" />
              Backend In-Memory Scheduler
            </h4>
            <p className="mt-0.5 text-[11px] text-[#9f927b] leading-tight">
              Registers this schedule with the active Node.js `node-cron` daemon.
            </p>
          </div>
          {syncStatus?.registered && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 text-[10px] text-emerald-300 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active in Memory
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleRegisterOnBackend}
            disabled={isSyncing || !isCurrentCronValid}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-[#8e7139]/60 bg-[#251e15] px-3 py-2 text-xs font-medium text-[#f0d58e] shadow transition hover:bg-[#342718] hover:border-[#d4ad58] disabled:opacity-50"
          >
            {isSyncing ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[#d4ad58]" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 text-[#d4ad58]" />
            )}
            Register in Backend Memory
          </button>

          <button
            type="button"
            onClick={handleTestRunNow}
            disabled={isTesting}
            title="Immediately trigger workflow execution starting at this Schedule Trigger"
            className="flex items-center justify-center gap-1.5 rounded-md border border-[#c69b45]/40 bg-[#c69b45]/15 px-3 py-2 text-xs font-semibold text-[#f0d58e] transition hover:bg-[#c69b45]/30 hover:border-[#c69b45] disabled:opacity-50"
          >
            {isTesting ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 text-[#d4ad58] fill-current" />
            )}
            Test Run Now
          </button>
        </div>

        {backendFeedback && (
          <div className="rounded border border-[#8e7139]/30 bg-[#120e0a] p-2 text-[11px] text-[#dec69e]">
            {backendFeedback}
          </div>
        )}
      </div>

      {/* 7. Database-free Notice */}
      <div className="flex items-start gap-2 rounded-md border border-[#8e7139]/25 bg-[#120d09]/60 p-2.5 text-[11px] text-[#9f927b]">
        <Info className="h-3.5 w-3.5 shrink-0 text-[#a9997b] mt-0.5" />
        <p>
          <strong className="text-[#dec69e]">In-Memory Architecture:</strong> Schedules are managed dynamically in server memory without a database. Saving the node stores configuration in the workflow graph, and registering synchronizes with active backend cron tasks.
        </p>
      </div>
    </div>
  )
}
