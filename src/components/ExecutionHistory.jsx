import { Check, Clock3, History, LoaderCircle, Trash2, Workflow } from 'lucide-react'

function formatTimestamp(timestamp) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'Unknown time'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatDuration(durationMs, status) {
  if (durationMs == null) return status === 'running' ? 'In progress' : 'Not recorded'
  if (durationMs < 1000) return `${durationMs} ms`
  return `${(durationMs / 1000).toFixed(1)} s`
}

function ExecutionHistory({
  executions,
  selectedExecutionId,
  onSelectExecution,
  onClearHistory,
  storageError,
}) {
  const selectedExecution = executions.find(({ id }) => id === selectedExecutionId)

  return (
    <section aria-label="Workflow execution history" className="h-full overflow-y-auto bg-[#100d0a] p-4 text-[#e5d8b8] sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#d4ad58]">
              <History aria-hidden="true" className="h-4 w-4" />
              Run history
            </p>
            <h1 className="font-display text-2xl text-[#f0e5c9]">Workflow executions</h1>
            <p className="mt-2 text-sm text-[#a9997b]">
              Review test runs and the steps completed in each one.
            </p>
          </div>
          {executions.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex items-center gap-2 rounded-md border border-[#8f4d3b]/40 px-3 py-2 text-xs text-[#d98a74] transition hover:bg-[#8f4d3b]/10"
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              Clear history
            </button>
          )}
        </div>

        {storageError && (
          <p role="alert" className="mb-4 rounded-lg border border-[#8f4d3b]/40 bg-[#241713] px-4 py-3 text-xs text-[#e3a18d]">
            {storageError}
          </p>
        )}

        <div className="grid min-h-96 gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]">
          <div className="overflow-hidden rounded-xl border border-[#8e7139]/25 bg-[#17120e]">
            <div className="border-b border-[#8e7139]/20 px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#c9b991]">
                Recent runs <span className="ml-1 text-[#88795e]">({executions.length})</span>
              </h2>
            </div>
            {executions.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-[#8e7139]/30 bg-[#100d0a] text-[#b28e4a]">
                  <Workflow aria-hidden="true" className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium text-[#e5d8b8]">No executions yet</p>
                <p className="mt-2 max-w-xs text-xs leading-5 text-[#88795e]">
                  Run a test from the editor and its status and step details will appear here.
                </p>
              </div>
            ) : (
              <ul className="max-h-[min(65vh,640px)] overflow-y-auto">
                {executions.map((execution) => {
                  const isSelected = execution.id === selectedExecutionId
                  const isRunning = execution.status === 'running'
                  const isInterrupted = execution.status === 'interrupted'
                  return (
                    <li key={execution.id} className="border-b border-[#8e7139]/15 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => onSelectExecution(execution.id)}
                        aria-pressed={isSelected}
                        className={`w-full px-4 py-4 text-left transition ${
                          isSelected ? 'bg-[#d4ad58]/10' : 'hover:bg-[#d4ad58]/5'
                        }`}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-[#e5d8b8]">
                            Test run
                          </span>
                          <span className={`inline-flex items-center gap-1.5 text-[11px] ${
                            isRunning || isInterrupted ? 'text-[#d4ad58]' : 'text-emerald-300'
                          }`}>
                            {isRunning
                              ? <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                              : <Check aria-hidden="true" className="h-3.5 w-3.5" />}
                            {isRunning ? 'Running' : isInterrupted ? 'Interrupted' : 'Complete'}
                          </span>
                        </span>
                        <span className="mt-2 block text-xs text-[#9d9076]">
                          {formatTimestamp(execution.startedAt)}
                        </span>
                        <span className="mt-2 flex items-center gap-3 text-[11px] text-[#88795e]">
                          <span>{execution.nodeCount} steps</span>
                          <span>{formatDuration(execution.durationMs, execution.status)}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-[#8e7139]/25 bg-[#17120e]">
            {selectedExecution ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#8e7139]/20 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-semibold text-[#f0e5c9]">Test run details</h2>
                    <p className="mt-1 text-xs text-[#9d9076]">
                      Started {formatTimestamp(selectedExecution.startedAt)}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#8e7139]/30 bg-[#100d0a] px-2.5 py-1 text-[11px] text-[#c9b991]">
                    <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
                    {formatDuration(selectedExecution.durationMs, selectedExecution.status)}
                  </span>
                </div>
                <div className="px-5 py-4">
                  <div className="mb-5 grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-[#8e7139]/20 bg-[#100d0a] p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[#88795e]">Result</p>
                      <p className={`mt-1.5 text-sm font-medium ${
                        selectedExecution.status === 'complete' ? 'text-emerald-300' : 'text-[#d4ad58]'
                      }`}>
                        {selectedExecution.status === 'running'
                          ? 'In progress'
                          : selectedExecution.status === 'interrupted'
                            ? 'Interrupted'
                            : 'Completed'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#8e7139]/20 bg-[#100d0a] p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[#88795e]">Steps</p>
                      <p className="mt-1.5 text-sm font-medium text-[#e5d8b8]">
                        {selectedExecution.steps.length} / {selectedExecution.nodeCount}
                      </p>
                    </div>
                  </div>

                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#c9b991]">
                    Step log
                  </h3>
                  {selectedExecution.steps.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[#8e7139]/25 px-4 py-6 text-center text-xs text-[#88795e]">
                      {selectedExecution.status === 'interrupted'
                        ? 'The page was closed before this run finished.'
                        : 'Waiting for the first step to start…'}
                    </p>
                  ) : (
                    <ol className="space-y-2">
                      {selectedExecution.steps.map((step, index) => (
                        <li key={`${selectedExecution.id}-${step.nodeId}`} className="flex gap-3 rounded-lg border border-[#8e7139]/20 bg-[#100d0a] px-3 py-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-700/50 bg-emerald-950/40 text-emerald-300">
                            <Check aria-hidden="true" className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center justify-between gap-2">
                              <span className="truncate text-xs font-medium text-[#e5d8b8]">{step.title}</span>
                              <span className="text-[10px] text-[#88795e]">
                                {formatTimestamp(step.completedAt)}
                              </span>
                            </span>
                            <span className="mt-1 block text-[10px] uppercase tracking-widest text-[#88795e]">
                              Step {index + 1} · {step.category || 'Action'}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                  <p className="mt-4 border-t border-[#8e7139]/15 pt-3 text-[10px] leading-5 text-[#766b59]">
                    Test runs simulate step progress in this demo. They do not call external services.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex min-h-96 flex-col items-center justify-center px-6 text-center">
                <p className="text-sm font-medium text-[#e5d8b8]">Select a run to inspect it</p>
                <p className="mt-2 max-w-xs text-xs leading-5 text-[#88795e]">
                  Run timing and completed workflow steps will be shown here.
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
