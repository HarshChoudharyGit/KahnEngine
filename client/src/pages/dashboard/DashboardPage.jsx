import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  GitBranch,
  LayoutDashboard,
  Loader2,
  MoreHorizontal,
  Network,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Workflow,
  XCircle,
  Zap,
} from 'lucide-react'
import { listWorkflows, saveWorkflow, deleteWorkflow, listExecutions, fetchHealth } from '../../services/api.js'

function formatRelativeTime(isoString) {
  if (!isoString) return 'Unknown'
  const diff = Date.now() - new Date(isoString).getTime()
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return new Date(isoString).toLocaleDateString()
}

function formatDateTime(isoString) {
  if (!isoString) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(isoString))
}

/** Stat card mini-component */
function StatCard({ icon: Icon, label, value, accent = false }) {
  return (
    <div className="rounded-xl border border-[#8e7139]/25 bg-[#17120e] p-4 transition hover:border-[#d4ad58]/40">
      <div className="flex items-center gap-2 mb-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent ? 'bg-[#d4ad58]/15 text-[#d4ad58]' : 'bg-[#8e7139]/15 text-[#c9b991]'}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#88795e]">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${accent ? 'text-[#f0d58e]' : 'text-[#e5d8b8]'}`}>{value}</p>
    </div>
  )
}

/** Empty state shown when no workflows exist */
function EmptyState({ onCreateNew }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#8e7139]/30 bg-gradient-to-br from-[#1e1b15] to-[#17120e] shadow-lg">
        <Workflow className="h-7 w-7 text-[#d4ad58]" />
      </span>
      <h2 className="text-lg font-semibold text-[#f0e5c9]">No workflows yet</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-[#9d9076]">
        Create your first workflow to start building automated pipelines with Kahn's Algorithm topological execution.
      </p>
      <button
        type="button"
        onClick={onCreateNew}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#c69b45] px-5 py-2.5 text-sm font-semibold text-[#21170c] shadow-md transition hover:bg-[#dfb95f] hover:shadow-lg active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        Create your first workflow
      </button>
    </div>
  )
}

/** Individual workflow card */
function WorkflowCard({ workflow, executionCount, onOpen, onDuplicate, onDelete }) {
  const [showMenu, setShowMenu] = useState(false)
  const nodeCount = workflow.nodes?.length || 0
  const edgeCount = workflow.edges?.length || 0

  return (
    <article className="group relative rounded-xl border border-[#8e7139]/25 bg-gradient-to-br from-[#1a1610] to-[#14110d] p-5 transition hover:border-[#d4ad58]/45 hover:shadow-xl hover:shadow-black/20">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#d4ad58]/30 bg-[#d4ad58]/10">
              <Network className="h-4 w-4 text-[#d4ad58]" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-[#f0e5c9] group-hover:text-[#f0d58e] transition">
                {workflow.name || 'Untitled Workflow'}
              </h3>
              <p className="truncate text-[11px] text-[#88795e] font-mono">{workflow.id}</p>
            </div>
          </div>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#a9997b] transition hover:bg-[#d4ad58]/10 hover:text-[#f0d58e]"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-8 z-50 min-w-40 rounded-lg border border-[#8e7139]/40 bg-[#17120e] p-1.5 shadow-2xl">
                <button
                  type="button"
                  onClick={() => { setShowMenu(false); onOpen(workflow.id) }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-[#e5d8b8] transition hover:bg-[#d4ad58]/10"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-[#d4ad58]" />
                  Open in editor
                </button>
                <button
                  type="button"
                  onClick={() => { setShowMenu(false); onDuplicate(workflow) }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-[#e5d8b8] transition hover:bg-[#d4ad58]/10"
                >
                  <Copy className="h-3.5 w-3.5 text-[#c9b991]" />
                  Duplicate
                </button>
                <div className="my-1 border-t border-[#8e7139]/20" />
                <button
                  type="button"
                  onClick={() => { setShowMenu(false); onDelete(workflow.id, workflow.name) }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-[#d98a74] transition hover:bg-[#8f4d3b]/15"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete workflow
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Metrics strip */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-[#9d9076]">
        <span className="inline-flex items-center gap-1">
          <GitBranch className="h-3 w-3 text-[#d4ad58]/70" />
          {nodeCount} node{nodeCount !== 1 ? 's' : ''}
        </span>
        <span className="inline-flex items-center gap-1">
          <Activity className="h-3 w-3 text-[#c9b991]/60" />
          {edgeCount} edge{edgeCount !== 1 ? 's' : ''}
        </span>
        {executionCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Zap className="h-3 w-3 text-emerald-400/70" />
            {executionCount} run{executionCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Timestamp footer */}
      <div className="mt-3 flex items-center justify-between border-t border-[#8e7139]/15 pt-3">
        <span className="flex items-center gap-1.5 text-[10px] text-[#766b59]">
          <Clock3 className="h-3 w-3" />
          {formatRelativeTime(workflow.updatedAt || workflow.createdAt)}
        </span>
        <button
          type="button"
          onClick={() => onOpen(workflow.id)}
          className="flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium text-[#d4ad58] transition hover:bg-[#d4ad58]/10"
        >
          Open <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </article>
  )
}

/** Create New Workflow modal */
function CreateWorkflowModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleCreate = async (e) => {
    e.preventDefault()
    const finalName = name.trim() || 'Untitled Workflow'
    setIsCreating(true)
    setError('')

    try {
      const result = await saveWorkflow({
        name: finalName,
        nodes: [],
        edges: [],
      })
      onCreated(result.workflow?.id || result.id)
    } catch (err) {
      setError(err.message || 'Failed to create workflow')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-xl border border-[#8e7139]/40 bg-[#17120e] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#8e7139]/25 px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#d4ad58]" />
            <h2 className="text-base font-semibold text-[#f0d58e]">New Workflow</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#a9997b] hover:bg-[#d4ad58]/10 hover:text-[#f0d58e]"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-5 space-y-4">
          <div>
            <label htmlFor="workflow-name" className="block text-xs font-medium text-[#c9b991] mb-1.5">
              Workflow name
            </label>
            <input
              id="workflow-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lead Scoring Pipeline"
              autoFocus
              className="w-full rounded-lg border border-[#8e7139]/35 bg-[#100d0a] px-3.5 py-2.5 text-sm text-[#f0e5c9] outline-none placeholder:text-[#756b5a] transition focus:border-[#c69b45]"
            />
          </div>

          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-md border border-rose-800/40 bg-rose-950/20 px-3 py-2 text-xs text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#8e7139]/35 px-4 py-2 text-xs font-medium text-[#c9b991] transition hover:bg-[#d4ad58]/8"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="inline-flex items-center gap-2 rounded-lg bg-[#c69b45] px-4 py-2 text-xs font-semibold text-[#21170c] transition hover:bg-[#dfb95f] disabled:opacity-60"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Create workflow
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/** Main Dashboard Page */
function DashboardPage() {
  const navigate = useNavigate()
  const [workflows, setWorkflows] = useState([])
  const [executions, setExecutions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [serverStatus, setServerStatus] = useState('checking') // 'checking' | 'online' | 'offline'
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { id, name }

  const loadData = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true)
    else setIsLoading(true)

    try {
      const [wfList, execList, health] = await Promise.allSettled([
        listWorkflows(),
        listExecutions(),
        fetchHealth(),
      ])

      if (wfList.status === 'fulfilled') setWorkflows(Array.isArray(wfList.value) ? wfList.value : [])
      if (execList.status === 'fulfilled') setExecutions(Array.isArray(execList.value) ? execList.value : [])
      setServerStatus(health.status === 'fulfilled' ? 'online' : 'offline')
    } catch {
      setServerStatus('offline')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOpenWorkflow = (workflowId) => {
    navigate(`/workspace?wf=${workflowId}`)
  }

  const handleCreateNew = () => {
    setShowCreateModal(true)
  }

  const handleWorkflowCreated = (workflowId) => {
    setShowCreateModal(false)
    if (workflowId) {
      navigate(`/workspace?wf=${workflowId}`)
    } else {
      navigate('/workspace')
    }
  }

  const handleDuplicate = async (workflow) => {
    try {
      const result = await saveWorkflow({
        name: `${workflow.name || 'Untitled'} (copy)`,
        nodes: workflow.nodes || [],
        edges: workflow.edges || [],
      })
      await loadData(true)
      if (result.workflow?.id) {
        navigate(`/workspace?wf=${result.workflow.id}`)
      }
    } catch (err) {
      console.error('Failed to duplicate:', err)
    }
  }

  const handleDeleteRequest = (id, name) => {
    setDeleteConfirm({ id, name })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return
    try {
      await deleteWorkflow(deleteConfirm.id)
      setWorkflows((prev) => prev.filter((w) => w.id !== deleteConfirm.id))
    } catch (err) {
      console.error('Failed to delete:', err)
    } finally {
      setDeleteConfirm(null)
    }
  }

  // Compute per-workflow execution counts
  const executionCountMap = {}
  for (const exec of executions) {
    executionCountMap[exec.workflowId] = (executionCountMap[exec.workflowId] || 0) + 1
  }

  const filteredWorkflows = workflows.filter((wf) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (wf.name || '').toLowerCase().includes(q) ||
      (wf.id || '').toLowerCase().includes(q)
    )
  })

  const totalRuns = executions.length
  const successRuns = executions.filter((e) => e.status === 'SUCCESS' || e.status === 'complete').length
  const failedRuns = executions.filter((e) => e.status === 'FAILED' || e.status === 'failed').length

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#100d0a]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#d4ad58]" />
          <p className="text-sm text-[#9d9076]">Loading dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#100d0a] text-[#e5d8b8]">
      {/* Top navigation bar */}
      <header className="sticky top-0 z-20 border-b border-[#8e7139]/25 bg-[#17120e]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-[#f0d58e] transition hover:opacity-80"
            >
              <LayoutDashboard className="h-5 w-5" />
              <span className="font-display text-base font-semibold tracking-wide hidden sm:block">
                Kahn Engine
              </span>
            </button>
            <span className="hidden text-[#8e7139]/50 sm:block">·</span>
            <span className="text-xs font-medium text-[#c9b991] hidden sm:block">Dashboard</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Server status indicator */}
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${
              serverStatus === 'online'
                ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/40'
                : serverStatus === 'offline'
                ? 'bg-rose-950/50 text-rose-300 border border-rose-800/40'
                : 'bg-amber-950/50 text-amber-300 border border-amber-800/40'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                serverStatus === 'online' ? 'bg-emerald-400' : serverStatus === 'offline' ? 'bg-rose-400' : 'bg-amber-400 animate-pulse'
              }`} />
              {serverStatus === 'online' ? 'API Online' : serverStatus === 'offline' ? 'API Offline' : 'Checking…'}
            </span>

            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#8e7139]/30 text-[#c9b991] transition hover:border-[#d4ad58]/50 hover:text-[#f0d58e] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleCreateNew}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#c69b45] px-3.5 py-2 text-xs font-semibold text-[#21170c] shadow-md transition hover:bg-[#dfb95f] active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:block">New Workflow</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-[#f0e5c9] sm:text-3xl">
            Workflow Dashboard
          </h1>
          <p className="mt-2 text-sm text-[#9d9076]">
            Manage, monitor, and launch your automation pipelines.
          </p>
        </div>

        {/* Stats grid */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Workflow} label="Workflows" value={workflows.length} accent />
          <StatCard icon={Zap} label="Total Runs" value={totalRuns} />
          <StatCard icon={CheckCircle2} label="Successful" value={successRuns} />
          <StatCard icon={XCircle} label="Failed" value={failedRuns} />
        </div>

        {/* Search + filter bar */}
        {workflows.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#88795e]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search workflows by name or ID…"
                className="w-full rounded-lg border border-[#8e7139]/30 bg-[#17120e] pl-9 pr-3 py-2.5 text-sm text-[#f0e5c9] outline-none placeholder:text-[#756b5a] transition focus:border-[#c69b45]"
              />
            </div>

            <span className="text-xs text-[#88795e]">
              {filteredWorkflows.length} of {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Workflow grid or empty state */}
        {workflows.length === 0 ? (
          <EmptyState onCreateNew={handleCreateNew} />
        ) : filteredWorkflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-8 w-8 text-[#8e7139]/50 mb-3" />
            <p className="text-sm font-medium text-[#e5d8b8]">No workflows match "{searchQuery}"</p>
            <p className="mt-1 text-xs text-[#88795e]">Try a different search term.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Quick Create Card */}
            <button
              type="button"
              onClick={handleCreateNew}
              className="group flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[#8e7139]/30 bg-[#14110d] p-8 transition hover:border-[#d4ad58]/50 hover:bg-[#1a1610]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#d4ad58]/30 bg-[#d4ad58]/10 transition group-hover:bg-[#d4ad58]/20 group-hover:scale-110">
                <Plus className="h-5 w-5 text-[#d4ad58]" />
              </span>
              <span className="text-sm font-medium text-[#c9b991] group-hover:text-[#f0d58e]">Create new workflow</span>
            </button>

            {filteredWorkflows.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                executionCount={executionCountMap[workflow.id] || 0}
                onOpen={handleOpenWorkflow}
                onDuplicate={handleDuplicate}
                onDelete={handleDeleteRequest}
              />
            ))}
          </div>
        )}

        {/* Recent executions summary */}
        {executions.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-[#c9b991]">
                <Activity className="h-4 w-4 text-[#d4ad58]" />
                Recent Executions
              </h2>
              <button
                type="button"
                onClick={() => navigate('/workspace')}
                className="text-xs text-[#d4ad58] transition hover:text-[#f0d58e]"
              >
                View all →
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#8e7139]/25 bg-[#17120e]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#8e7139]/20">
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.1em] text-[#88795e]">Execution ID</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.1em] text-[#88795e] hidden sm:table-cell">Workflow</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.1em] text-[#88795e]">Status</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.1em] text-[#88795e] hidden md:table-cell">Started</th>
                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-[0.1em] text-[#88795e] hidden lg:table-cell">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#8e7139]/12">
                  {executions.slice(0, 8).map((exec) => {
                    const isRunning = exec.status === 'RUNNING' || exec.status === 'running'
                    const isFailed = exec.status === 'FAILED' || exec.status === 'failed'
                    const isSuccess = exec.status === 'SUCCESS' || exec.status === 'complete'

                    return (
                      <tr key={exec.id} className="transition hover:bg-[#d4ad58]/5">
                        <td className="px-4 py-3 font-mono text-[#e5d8b8]">{exec.id}</td>
                        <td className="px-4 py-3 text-[#9d9076] hidden sm:table-cell">{exec.workflowName || exec.workflowId || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                            isRunning
                              ? 'bg-amber-950/50 text-[#d4ad58]'
                              : isFailed
                              ? 'bg-rose-950/50 text-rose-300'
                              : isSuccess
                              ? 'bg-emerald-950/50 text-emerald-300'
                              : 'bg-[#8e7139]/15 text-[#c9b991]'
                          }`}>
                            {isRunning ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : isFailed ? (
                              <XCircle className="h-2.5 w-2.5" />
                            ) : isSuccess ? (
                              <CheckCircle2 className="h-2.5 w-2.5" />
                            ) : null}
                            {exec.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#88795e] hidden md:table-cell">{formatRelativeTime(exec.startedAt)}</td>
                        <td className="px-4 py-3 text-right font-mono text-[#c9b991] hidden lg:table-cell">
                          {exec.durationMs != null ? `${exec.durationMs}ms` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* Create Workflow Modal */}
      <CreateWorkflowModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleWorkflowCreated}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(null) }}
        >
          <div className="w-full max-w-sm rounded-xl border border-rose-800/40 bg-[#17120e] p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-rose-400" />
              <h3 className="text-sm font-semibold text-[#f0e5c9]">Delete workflow?</h3>
            </div>
            <p className="text-xs text-[#9d9076] leading-5">
              This will permanently delete <strong className="text-[#e5d8b8]">"{deleteConfirm.name}"</strong>.
              This action cannot be undone.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-[#8e7139]/35 px-4 py-2 text-xs font-medium text-[#c9b991] transition hover:bg-[#d4ad58]/8"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardPage
