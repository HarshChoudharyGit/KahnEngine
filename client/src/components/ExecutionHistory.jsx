import { useState, useEffect, useRef } from 'react'
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  History,
  LoaderCircle,
  RefreshCw,
  Terminal,
  Trash2,
  Workflow,
  XCircle,
} from 'lucide-react'

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Just now'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'Unknown time'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date)
}

function formatDuration(durationMs, status) {
  if (durationMs == null) {
    return status === 'running' ? 'In progress…' : 'Pending'
  }
  if (durationMs < 1000) return `${durationMs} ms`
  return `${(durationMs / 1000).toFixed(2)} s`
}

function ExecutionHistory({
  executions,
  selectedExecutionId,
  onSelectExecution,
  onClearHistory,
  onRefreshHistory,
  storageError,
  isRefreshing,
}) {
  const [activeView, setActiveView] = useState('both') // 'steps' | 'logs' | 'both'
  const [expandedSteps, setExpandedSteps] = useState({})
  const [copiedLog, setCopiedLog] = useState(false)
  const logsEndRef = useRef(null)

  const selectedExecution = executions.find(({ id }) => id === selectedExecutionId)

  // Auto-scroll logs terminal when new logs arrive
  useEffect(() => {
    if (logsEndRef.current && selectedExecution?.status === 'running') {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [selectedExecution?.logs?.length, selectedExecution?.status])

  const toggleStepExpanded = (nodeId) => {
    setExpandedSteps((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }))
  }

  const copyExecutionLogs = () => {
    if (!selectedExecution?.logs) return
    const text = selectedExecution.logs
      .map((l) => `[${new Date(l.timestamp).toISOString()}] [${l.level || 'INFO'}] ${l.nodeTitle ? `(${l.nodeTitle}) ` : ''}${l.message}`)
      .join('\n')
    navigator.clipboard.writeText(text)
    setCopiedLog(true)
    setTimeout(() => setCopiedLog(false), 2000)
  }

  return (
    <section aria-label="Workflow execution history" className="h-full overflow-y-auto bg-[#100d0a] p-4 text-[#e5d8b8] sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#d4ad58]">
              <History aria-hidden="true" className="h-4 w-4" />
              Live Telemetry & Run History
            </p>
            <h1 className="font-display text-2xl text-[#f0e5c9]">Workflow Executions</h1>
            <p className="mt-2 text-sm text-[#a9997b]">
              Real-time SSE event stream, per-node execution timings, and distributed worker logs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onRefreshHistory && (
              <button
                type="button"
                onClick={onRefreshHistory}
                disabled={isRefreshing}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#8e7139]/40 bg-[#17120e] px-3 py-2 text-xs text-[#c9b991] transition hover:bg-[#d4ad58]/10 hover:text-[#f0d58e] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}
            {executions.length > 0 && (
              <button
                type="button"
                onClick={onClearHistory}
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#8f4d3b]/40 px-3 py-2 text-xs text-[#d98a74] transition hover:bg-[#8f4d3b]/10"
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                Clear history
              </button>
            )}
          </div>
        </div>

        {storageError && (
          <p role="alert" className="mb-4 rounded-lg border border-[#8f4d3b]/40 bg-[#241713] px-4 py-3 text-xs text-[#e3a18d]">
            {storageError}
          </p>
        )}

        <div className="grid min-h-[560px] gap-4 lg:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.65fr)]">
          {/* Left: Execution List */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-[#8e7139]/25 bg-[#17120e]">
            <div className="border-b border-[#8e7139]/20 px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#c9b991]">
                Past & Active Runs <span className="ml-1 text-[#88795e]">({executions.length})</span>
              </h2>
            </div>
            {executions.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-[#8e7139]/30 bg-[#100d0a] text-[#b28e4a]">
                  <Workflow aria-hidden="true" className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium text-[#e5d8b8]">No executions recorded yet</p>
                <p className="mt-2 max-w-xs text-xs leading-5 text-[#88795e]">
                  Click &quot;Test workflow&quot; in the canvas editor to dispatch an execution through the Fastify gateway.
                </p>
              </div>
            ) : (
              <ul className="flex-1 overflow-y-auto max-h-[720px] divide-y divide-[#8e7139]/15">
                {executions.map((execution) => {
                  const isSelected = execution.id === selectedExecutionId
                  const isRunning = execution.status === 'running' || execution.status === 'RUNNING'
                  const isFailed = execution.status === 'failed' || execution.status === 'FAILED'
                  const isComplete = execution.status === 'complete' || execution.status === 'SUCCESS'

                  return (
                    <li key={execution.id}>
                      <button
                        type="button"
                        onClick={() => onSelectExecution(execution.id)}
                        aria-pressed={isSelected}
                        className={`w-full cursor-pointer px-4 py-3.5 text-left transition ${
                          isSelected ? 'bg-[#d4ad58]/12 border-l-2 border-[#d4ad58]' : 'hover:bg-[#d4ad58]/5'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-mono text-xs font-semibold text-[#f0e5c9]">
                            {execution.id}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                              isRunning
                                ? 'bg-amber-950/50 text-[#d4ad58] border border-amber-800/40'
                                : isFailed
                                ? 'bg-rose-950/50 text-rose-300 border border-rose-800/40'
                                : 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/40'
                            }`}
                          >
                            {isRunning ? (
                              <LoaderCircle aria-hidden="true" className="h-3 w-3 animate-spin" />
                            ) : isFailed ? (
                              <XCircle aria-hidden="true" className="h-3 w-3" />
                            ) : (
                              <Check aria-hidden="true" className="h-3 w-3" />
                            )}
                            {isRunning ? 'Running' : isFailed ? 'Failed' : 'Success'}
                          </span>
                        </div>
                        <span className="mt-1.5 block text-[11px] text-[#9d9076]">
                          {formatTimestamp(execution.startedAt)}
                        </span>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-[#88795e]">
                          <span>{(execution.steps || []).length} completed</span>
                          <span className="font-mono">{formatDuration(execution.durationMs, execution.status)}</span>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Right: Selected Execution Detail & Live Console */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-[#8e7139]/25 bg-[#17120e]">
            {selectedExecution ? (
              <>
                {/* Header Banner */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#8e7139]/20 px-5 py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-mono text-sm font-bold text-[#f0e5c9]">
                        {selectedExecution.id}
                      </h2>
                      {selectedExecution.status === 'running' && (
                        <span className="flex items-center gap-1.5 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-[#d4ad58] animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#d4ad58]" />
                          SSE Streaming Active
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[#9d9076]">
                      Started {formatTimestamp(selectedExecution.startedAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-[#8e7139]/30 bg-[#100d0a] px-3 py-1.5 font-mono text-xs text-[#c9b991]">
                      <Clock3 aria-hidden="true" className="h-3.5 w-3.5 text-[#d4ad58]" />
                      {formatDuration(selectedExecution.durationMs, selectedExecution.status)}
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  {/* Status & Metrics Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-[#8e7139]/20 bg-[#100d0a] p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[#88795e]">Execution State</p>
                      <p
                        className={`mt-1.5 text-sm font-semibold capitalize ${
                          selectedExecution.status === 'running'
                            ? 'text-[#d4ad58]'
                            : selectedExecution.status === 'failed' || selectedExecution.status === 'FAILED'
                            ? 'text-rose-400'
                            : 'text-emerald-300'
                        }`}
                      >
                        {selectedExecution.status}
                      </p>
                    </div>

                    <div className="rounded-lg border border-[#8e7139]/20 bg-[#100d0a] p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[#88795e]">Topological Steps</p>
                      <p className="mt-1.5 text-sm font-medium text-[#e5d8b8]">
                        {(selectedExecution.steps || []).length} / {selectedExecution.nodeCount || (selectedExecution.steps || []).length}
                      </p>
                    </div>

                    <div className="rounded-lg border border-[#8e7139]/20 bg-[#100d0a] p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[#88795e]">Worker Telemetry</p>
                      <p className="mt-1.5 text-sm font-medium text-[#c9b991]">
                        {(selectedExecution.logs || []).length} events
                      </p>
                    </div>
                  </div>

                  {selectedExecution.error && (
                    <div className="rounded-lg border border-rose-800/40 bg-rose-950/20 p-3.5 text-xs text-rose-300 flex items-start gap-2.5">
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                      <div>
                        <span className="font-semibold">Pipeline Execution Terminated:</span>
                        <p className="mt-0.5 font-mono text-[11px] text-rose-200">{selectedExecution.error}</p>
                      </div>
                    </div>
                  )}

                  {/* Toggle Views */}
                  <div className="flex items-center justify-between border-b border-[#8e7139]/20 pb-2">
                    <div className="flex items-center gap-1 rounded-md bg-[#100d0a] p-1 border border-[#8e7139]/20">
                      {[
                        ['both', 'Overview & Console'],
                        ['steps', 'Steps Only'],
                        ['logs', 'Live Console'],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setActiveView(id)}
                          className={`cursor-pointer rounded px-2.5 py-1 text-xs transition ${
                            activeView === id ? 'bg-[#d4ad58]/20 font-medium text-[#f0d58e]' : 'text-[#88795e] hover:text-[#e5d8b8]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {(selectedExecution.logs || []).length > 0 && (
                      <button
                        type="button"
                        onClick={copyExecutionLogs}
                        className="inline-flex cursor-pointer items-center gap-1 text-xs text-[#a9997b] hover:text-[#f0d58e] transition"
                      >
                        <Copy className="h-3 w-3" />
                        {copiedLog ? 'Copied!' : 'Copy raw log'}
                      </button>
                    )}
                  </div>

                  {/* Step List View */}
                  {(activeView === 'steps' || activeView === 'both') && (
                    <div>
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#c9b991]">
                        Deterministic Topological Steps (Kahn’s Sort)
                      </h3>
                      {(!selectedExecution.steps || selectedExecution.steps.length === 0) ? (
                        <div className="rounded-lg border border-dashed border-[#8e7139]/25 p-5 text-center text-xs text-[#88795e]">
                          {selectedExecution.status === 'running'
                            ? 'Awaiting first node completion from BullMQ worker…'
                            : 'No node execution steps recorded.'}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedExecution.steps.map((step, index) => {
                            const isExpanded = expandedSteps[step.nodeId]
                            const isFailed = step.status === 'FAILED' || step.status === 'failed'
                            const isRunning = step.status === 'RUNNING' || step.status === 'running'

                            return (
                              <div
                                key={`${selectedExecution.id}-${step.nodeId || index}`}
                                className="rounded-lg border border-[#8e7139]/25 bg-[#100d0a] overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleStepExpanded(step.nodeId)}
                                  className="w-full cursor-pointer flex items-center justify-between p-3 text-left transition hover:bg-[#1a140f]"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span
                                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                        isRunning
                                          ? 'border border-amber-600/50 bg-amber-950/40 text-amber-300'
                                          : isFailed
                                          ? 'border border-rose-700/50 bg-rose-950/40 text-rose-300'
                                          : 'border border-emerald-700/50 bg-emerald-950/40 text-emerald-300'
                                      }`}
                                    >
                                      {isRunning ? (
                                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                      ) : isFailed ? (
                                        <XCircle className="h-3.5 w-3.5" />
                                      ) : (
                                        <Check className="h-3.5 w-3.5" />
                                      )}
                                    </span>
                                    <div className="truncate">
                                      <p className="truncate text-xs font-medium text-[#e5d8b8]">
                                        {step.title}
                                      </p>
                                      <p className="text-[10px] uppercase tracking-wider text-[#88795e]">
                                        Step {index + 1} · {step.category || 'ACTION'}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    {step.durationMs != null && (
                                      <span className="font-mono text-[11px] text-[#c9b991]">
                                        {step.durationMs}ms
                                      </span>
                                    )}
                                    {step.output && (
                                      <span className="text-[#88795e]">
                                        {isExpanded ? (
                                          <ChevronDown className="h-4 w-4" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4" />
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </button>

                                {isExpanded && step.output && (
                                  <div className="border-t border-[#8e7139]/15 bg-[#0b0907] p-3 text-[11px] font-mono">
                                    <p className="text-[10px] font-semibold text-[#88795e] mb-1 uppercase tracking-wider">
                                      Node Output Context:
                                    </p>
                                    <pre className="max-h-48 overflow-auto text-[#a8d3a0]">
                                      {JSON.stringify(step.output, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Terminal Console View */}
                  {(activeView === 'logs' || activeView === 'both') && (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#c9b991]">
                          <Terminal className="h-3.5 w-3.5 text-[#d4ad58]" />
                          Live Execution Telemetry Stream
                        </h3>
                        <span className="text-[10px] text-[#766b59] font-mono">
                          SSE /api/v1/telemetry/stream/{selectedExecution.id}
                        </span>
                      </div>

                      <div className="rounded-lg border border-[#8e7139]/30 bg-[#0c0907] p-3.5 font-mono text-xs shadow-inner max-h-80 overflow-y-auto">
                        {(!selectedExecution.logs || selectedExecution.logs.length === 0) ? (
                          <p className="text-[#685c49] italic">
                            Waiting for node telemetry events to arrive over SSE…
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {selectedExecution.logs.map((log, index) => {
                              const isError = log.level === 'ERROR'
                              const isWarn = log.level === 'WARN'

                              return (
                                <div key={index} className="flex items-start gap-2 leading-relaxed">
                                  <span className="text-[#594f3e] shrink-0">
                                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                  </span>
                                  <span
                                    className={`shrink-0 rounded px-1 text-[10px] font-semibold ${
                                      isError
                                        ? 'bg-rose-950 text-rose-300'
                                        : isWarn
                                        ? 'bg-amber-950 text-amber-300'
                                        : 'bg-teal-950 text-teal-300'
                                    }`}
                                  >
                                    [{log.level || 'INFO'}]
                                  </span>
                                  {log.nodeTitle && (
                                    <span className="text-[#d4ad58] shrink-0">
                                      [{log.nodeTitle}]
                                    </span>
                                  )}
                                  <span className={`min-w-0 break-words ${isError ? 'text-rose-200' : 'text-[#e5d8b8]'}`}>
                                    {log.message}
                                  </span>
                                </div>
                              )
                            })}
                            <div ref={logsEndRef} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <Workflow className="h-8 w-8 text-[#8e7139]/50 mb-3" />
                <p className="text-sm font-medium text-[#e5d8b8]">Select a run to inspect telemetry</p>
                <p className="mt-1 max-w-xs text-xs text-[#88795e]">
                  Per-node execution timings, outputs, and live SSE worker logs will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default ExecutionHistory
