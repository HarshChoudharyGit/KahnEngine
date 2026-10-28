import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Flame,
  GitBranch,
  Globe,
  HelpCircle,
  Mail,
  Play,
  Save,
  Send,
  Sparkles,
  Split,
  Timer,
  Wand2,
  X,
  Zap,
} from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'notEquals', label: 'Does Not Equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'greaterThan', label: 'Greater Than' },
  { value: 'lessThan', label: 'Less Than' },
  { value: 'isEmpty', label: 'Is Empty' },
]

const GITHUB_EVENTS = [
  { value: 'issues', label: 'Issue Created' },
  { value: 'push', label: 'Git Push' },
  { value: 'pull_request', label: 'Pull Request' },
  { value: 'release', label: 'Release' },
]

export default function NodeDetailsModal({
  isOpen,
  workflow,
  onClose,
  onApplyAndExecute,
  isExecuting = false,
}) {
  const [workflowName, setWorkflowName] = useState('')
  const [nodeConfigs, setNodeConfigs] = useState({})
  const [expandedNodes, setExpandedNodes] = useState({})
  const [githubRepos, setGithubRepos] = useState([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})

  // Initialize form state when workflow opens
  useEffect(() => {
    if (!isOpen || !workflow) return

    setWorkflowName(workflow.name || 'AI Designed Workflow')

    const initialConfigs = {}
    const initialExpanded = {}

    ;(workflow.nodes || []).forEach((node, idx) => {
      const config = { ...(node.data?.configuration || {}) }
      initialConfigs[node.id] = config
      // Expand all nodes by default so user sees everything clearly
      initialExpanded[node.id] = true
    })

    setNodeConfigs(initialConfigs)
    setExpandedNodes(initialExpanded)
    setValidationErrors({})

    // Fetch user's connected GitHub repositories if there is a githubTrigger
    const hasGithubNode = (workflow.nodes || []).some(
      (n) => String(n.data?.configType || '').toLowerCase().includes('github'),
    )

    if (hasGithubNode) {
      setIsLoadingRepos(true)
      fetch(`${API_BASE_URL}/api/integrations/github/repositories`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.repositories && Array.isArray(data.repositories)) {
            setGithubRepos(data.repositories)
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingRepos(false))
    }
  }, [isOpen, workflow])

  if (!isOpen || !workflow) return null

  const handleFieldChange = (nodeId, fieldKey, value) => {
    setNodeConfigs((prev) => ({
      ...prev,
      [nodeId]: {
        ...(prev[nodeId] || {}),
        [fieldKey]: value,
      },
    }))

    // Clear validation error for this field
    setValidationErrors((prev) => {
      const next = { ...prev }
      delete next[`${nodeId}-${fieldKey}`]
      return next
    })
  }

  const toggleExpand = (nodeId) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }))
  }

  // Check if a value looks like a placeholder that needs user input
  const isPlaceholderValue = (val) => {
    if (!val || typeof val !== 'string') return false
    const lower = val.toLowerCase()
    return (
      lower.includes('owner/repo') ||
      lower.includes('recipient@example.com') ||
      lower.includes('recipient email') ||
      lower.includes('your-org') ||
      lower.includes('api.example.com') ||
      lower.includes('example.com')
    )
  }

  const validateAll = () => {
    const errors = {}
    ;(workflow.nodes || []).forEach((node) => {
      const type = String(node.data?.configType || '').toLowerCase()
      const cfg = nodeConfigs[node.id] || {}

      if (type.includes('github')) {
        const repo = String(cfg.repository || '').trim()
        if (!repo || repo === 'owner/repo' || !/^[^/\s]+\/[^/\s]+$/.test(repo)) {
          errors[`${node.id}-repository`] = 'Valid repository in owner/repo format is required.'
        }
      } else if (type.includes('gmail') && !type.includes('trigger')) {
        const to = String(cfg.to || '').trim()
        if (!to || to === 'recipient@example.com') {
          errors[`${node.id}-to`] = 'Recipient email address is required.'
        }
        if (!String(cfg.subject || '').trim()) {
          errors[`${node.id}-subject`] = 'Email subject is required.'
        }
      } else if (type.includes('webhook')) {
        const path = String(cfg.path || '').trim()
        if (!path.startsWith('/') || path.length < 2) {
          errors[`${node.id}-path`] = 'Path must start with / (e.g. /v1/webhook).'
        }
      } else if (type === 'condition') {
        if (!String(cfg.leftValue || '').trim()) {
          errors[`${node.id}-leftValue`] = 'Value to evaluate is required.'
        }
      }
    })

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (shouldExecuteImmediately = true) => {
    const isValid = validateAll()
    if (!isValid) return

    onApplyAndExecute({
      workflowName: workflowName.trim() || workflow.name,
      nodeConfigs,
      shouldExecute: shouldExecuteImmediately,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-black/60 animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-purple-500/30 bg-[#14101e] shadow-2xl shadow-purple-500/10 text-[#f0e5c9] overflow-hidden">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-purple-500/20 bg-gradient-to-r from-purple-950/40 via-[#181226] to-[#14101e] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">
                  Workflow Setup & Node Details
                </h2>
                <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-purple-300 border border-purple-500/30">
                  AI Agent Configured
                </span>
              </div>
              <p className="text-xs text-purple-300/70">
                The agent designed this workflow. Review required details for each node and execute.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-purple-400/60 hover:bg-purple-500/10 hover:text-purple-200 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Workflow Title Input */}
        <div className="border-b border-purple-500/15 bg-purple-950/15 px-6 py-3">
          <label className="block text-[11px] font-medium uppercase tracking-wider text-purple-300/60 mb-1">
            Workflow Name
          </label>
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            placeholder="Enter workflow title..."
            className="w-full rounded-lg border border-purple-500/25 bg-[#1b1528] px-3.5 py-2 text-sm text-white placeholder-purple-400/30 outline-none focus:border-purple-400 transition"
          />
        </div>

        {/* Nodes List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 max-h-[58vh]">
          <div className="flex items-center justify-between text-xs text-purple-300/60 mb-1">
            <span>Configuring {(workflow.nodes || []).length} Nodes in Execution Order</span>
            <span className="text-[11px] text-amber-400/80 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Highlighted fields require your real account values
            </span>
          </div>

          {(workflow.nodes || []).map((node, index) => {
            const type = String(node.data?.configType || '').toLowerCase()
            const cfg = nodeConfigs[node.id] || {}
            const isExpanded = expandedNodes[node.id] !== false
            const accent = node.data?.accent || '#a78bfa'

            return (
              <div
                key={node.id}
                className="overflow-hidden rounded-xl border border-purple-500/20 bg-[#181324] shadow-md transition hover:border-purple-500/35"
              >
                {/* Node Card Header */}
                <div
                  onClick={() => toggleExpand(node.id)}
                  className="flex items-center justify-between px-4 py-3 bg-[#1e172e]/60 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-black"
                      style={{ backgroundColor: accent }}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {node.data?.title || node.id}
                        </span>
                        <span
                          className="rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase text-black/90"
                          style={{ backgroundColor: accent }}
                        >
                          {node.data?.category || 'NODE'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#c9b991]/70">
                        {node.data?.subtitle || 'Node configuration parameters'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-purple-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-purple-400" />
                    )}
                  </div>
                </div>

                {/* Node Fields Body */}
                {isExpanded && (
                  <div className="p-4 space-y-3.5 border-t border-purple-500/15 bg-[#161221]">
                    {/* 1. GITHUB TRIGGER */}
                    {type.includes('github') && (
                      <div className="space-y-3">
                        <div>
                          <label className="flex items-center justify-between text-xs font-medium text-[#e5d8b8] mb-1">
                            <span>Repository (owner/repo) *</span>
                            {isPlaceholderValue(cfg.repository) && (
                              <span className="text-[10px] text-amber-400 font-semibold bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/30">
                                Select or enter your repo
                              </span>
                            )}
                          </label>

                          {githubRepos.length > 0 ? (
                            <select
                              value={cfg.repository || ''}
                              onChange={(e) => handleFieldChange(node.id, 'repository', e.target.value)}
                              className={`w-full rounded-lg border px-3 py-2 text-xs bg-[#1f1830] text-white outline-none transition ${
                                isPlaceholderValue(cfg.repository) || validationErrors[`${node.id}-repository`]
                                  ? 'border-amber-400/70 focus:border-amber-400'
                                  : 'border-purple-500/30 focus:border-purple-400'
                              }`}
                            >
                              <option value="">Select a repository...</option>
                              {githubRepos.map((repo) => (
                                <option key={repo.id} value={repo.full_name}>
                                  {repo.full_name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={cfg.repository || ''}
                              onChange={(e) => handleFieldChange(node.id, 'repository', e.target.value)}
                              placeholder="e.g. HarshChoudharyGit/FirstRepo"
                              className={`w-full rounded-lg border px-3 py-2 text-xs bg-[#1f1830] text-white placeholder-purple-400/30 outline-none transition ${
                                isPlaceholderValue(cfg.repository) || validationErrors[`${node.id}-repository`]
                                  ? 'border-amber-400/70 focus:border-amber-400'
                                  : 'border-purple-500/30 focus:border-purple-400'
                              }`}
                            />
                          )}
                          {validationErrors[`${node.id}-repository`] && (
                            <p className="mt-1 text-[11px] text-rose-400">
                              {validationErrors[`${node.id}-repository`]}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-[#e5d8b8] mb-1">
                              Trigger Events
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {GITHUB_EVENTS.map((evt) => {
                                const currentEvents = Array.isArray(cfg.events) ? cfg.events : [cfg.events || 'issues']
                                const isSelected = currentEvents.includes(evt.value)
                                return (
                                  <button
                                    key={evt.value}
                                    type="button"
                                    onClick={() => {
                                      const nextEvents = isSelected
                                        ? currentEvents.filter((e) => e !== evt.value)
                                        : [...currentEvents, evt.value]
                                      handleFieldChange(node.id, 'events', nextEvents.length > 0 ? nextEvents : ['issues'])
                                    }}
                                    className={`rounded px-2.5 py-1 text-[11px] font-medium transition cursor-pointer ${
                                      isSelected
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-[#1f1830] text-purple-300/70 hover:bg-purple-500/10'
                                    }`}
                                  >
                                    {evt.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-[#e5d8b8] mb-1">
                              Branch
                            </label>
                            <input
                              type="text"
                              value={cfg.branch || 'main'}
                              onChange={(e) => handleFieldChange(node.id, 'branch', e.target.value)}
                              placeholder="main"
                              className="w-full rounded-lg border border-purple-500/30 bg-[#1f1830] px-3 py-2 text-xs text-white placeholder-purple-400/30 outline-none focus:border-purple-400"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. GMAIL ACTION */}
                    {type.includes('gmail') && !type.includes('trigger') && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-[#e5d8b8] mb-1">
                              Gmail Operation
                            </label>
                            <select
                              value={cfg.operation || 'send_email'}
                              onChange={(e) => handleFieldChange(node.id, 'operation', e.target.value)}
                              className="w-full rounded-lg border border-purple-500/30 bg-[#1f1830] px-3 py-2 text-xs text-white outline-none focus:border-purple-400"
                            >
                              <option value="send_email">Send Email</option>
                              <option value="reply_email">Reply to Email</option>
                              <option value="search_emails">Search Emails</option>
                              <option value="add_label">Add Label</option>
                            </select>
                          </div>

                          <div>
                            <label className="flex items-center justify-between text-xs font-medium text-[#e5d8b8] mb-1">
                              <span>Recipient Email (To) *</span>
                              {isPlaceholderValue(cfg.to) && (
                                <span className="text-[10px] text-amber-400 font-semibold bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/30">
                                  Enter recipient email
                                </span>
                              )}
                            </label>
                            <input
                              type="text"
                              value={cfg.to || ''}
                              onChange={(e) => handleFieldChange(node.id, 'to', e.target.value)}
                              placeholder="user@example.com or {{outputs.email}}"
                              className={`w-full rounded-lg border px-3 py-2 text-xs bg-[#1f1830] text-white placeholder-purple-400/30 outline-none transition ${
                                isPlaceholderValue(cfg.to) || validationErrors[`${node.id}-to`]
                                  ? 'border-amber-400/70 focus:border-amber-400'
                                  : 'border-purple-500/30 focus:border-purple-400'
                              }`}
                            />
                            {validationErrors[`${node.id}-to`] && (
                              <p className="mt-1 text-[11px] text-rose-400">
                                {validationErrors[`${node.id}-to`]}
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-[#e5d8b8] mb-1">
                            Subject *
                          </label>
                          <input
                            type="text"
                            value={cfg.subject || ''}
                            onChange={(e) => handleFieldChange(node.id, 'subject', e.target.value)}
                            placeholder="Email subject..."
                            className="w-full rounded-lg border border-purple-500/30 bg-[#1f1830] px-3 py-2 text-xs text-white placeholder-purple-400/30 outline-none focus:border-purple-400"
                          />
                          {validationErrors[`${node.id}-subject`] && (
                            <p className="mt-1 text-[11px] text-rose-400">
                              {validationErrors[`${node.id}-subject`]}
                            </p>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-medium text-[#e5d8b8]">
                              Email Body *
                            </label>
                            <span className="text-[10px] text-purple-300/60">
                              Supports markdown & dynamic template tags
                            </span>
                          </div>
                          <textarea
                            rows={6}
                            value={cfg.body || ''}
                            onChange={(e) => handleFieldChange(node.id, 'body', e.target.value)}
                            placeholder="Email body content..."
                            className="w-full rounded-lg border border-purple-500/30 bg-[#1f1830] px-3.5 py-2.5 font-mono text-xs text-white placeholder-purple-400/30 outline-none focus:border-purple-400 resize-y leading-relaxed"
                          />

                          {/* Quick Template Tag Pills */}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] text-purple-400/70 mr-0.5">Insert variable:</span>
                            {[
                              { label: '+ Comment', tag: '{{trigger.payload.head_commit.message}}' },
                              { label: '+ Timestamp', tag: '{{trigger.payload.head_commit.timestamp}}' },
                              { label: '+ Author', tag: '{{trigger.payload.head_commit.author.name}}' },
                              { label: '+ Commit URL', tag: '{{trigger.payload.head_commit.url}}' },
                              { label: '+ Repo', tag: '{{trigger.payload.repository.full_name}}' },
                              { label: '+ Branch', tag: '{{trigger.payload.ref}}' },
                            ].map((item) => (
                              <button
                                key={item.label}
                                type="button"
                                onClick={() => {
                                  const currentBody = cfg.body || '';
                                  handleFieldChange(node.id, 'body', currentBody ? `${currentBody} ${item.tag}` : item.tag);
                                }}
                                className="rounded bg-purple-500/15 border border-purple-500/25 px-2 py-0.5 text-[10px] font-medium text-purple-300 hover:bg-purple-500/25 hover:text-white transition cursor-pointer"
                                title={`Insert ${item.tag}`}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. CONDITION / IF-ELSE */}
                    {type === 'condition' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2.5">
                          <div>
                            <label className="block text-xs font-medium text-[#e5d8b8] mb-1">
                              Value to Evaluate *
                            </label>
                            <input
                              type="text"
                              value={cfg.leftValue || ''}
                              onChange={(e) => handleFieldChange(node.id, 'leftValue', e.target.value)}
                              placeholder="{{trigger.payload.action}}"
                              className="w-full rounded-lg border border-purple-500/30 bg-[#1f1830] px-3 py-2 text-xs text-white outline-none focus:border-purple-400"
                            />
                            {validationErrors[`${node.id}-leftValue`] && (
                              <p className="mt-1 text-[11px] text-rose-400">
                                {validationErrors[`${node.id}-leftValue`]}
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-[#e5d8b8] mb-1">
                              Operator
                            </label>
                            <select
                              value={cfg.operator || 'equals'}
                              onChange={(e) => handleFieldChange(node.id, 'operator', e.target.value)}
                              className="w-full rounded-lg border border-purple-500/30 bg-[#1f1830] px-3 py-2 text-xs text-white outline-none focus:border-purple-400"
                            >
                              {CONDITION_OPERATORS.map((op) => (
                                <option key={op.value} value={op.value}>
                                  {op.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-[#e5d8b8] mb-1">
                              Comparison Value
                            </label>
                            <input
                              type="text"
                              value={cfg.rightValue || ''}
                              onChange={(e) => handleFieldChange(node.id, 'rightValue', e.target.value)}
                              placeholder="opened"
                              className="w-full rounded-lg border border-purple-500/30 bg-[#1f1830] px-3 py-2 text-xs text-white outline-none focus:border-purple-400"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4. WEBHOOK TRIGGER */}
                    {type.includes('webhook') && (
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[#e5d8b8] mb-1">
                            HTTP Method
                          </label>
                          <select
                            value={cfg.method || 'POST'}
                            onChange={(e) => handleFieldChange(node.id, 'method', e.target.value)}
                            className="w-full rounded-lg border border-purple-500/30 bg-[#1f1830] px-3 py-2 text-xs text-white outline-none focus:border-purple-400"
                          >
                            <option value="POST">POST</option>
                            <option value="GET">GET</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-[#e5d8b8] mb-1">
                            Webhook Path *
                          </label>
                          <input
                            type="text"
                            value={cfg.path || '/v1/webhook'}
                            onChange={(e) => handleFieldChange(node.id, 'path', e.target.value)}
                            placeholder="/v1/my-webhook"
                            className="w-full rounded-lg border border-purple-500/30 bg-[#1f1830] px-3 py-2 text-xs text-white outline-none focus:border-purple-400"
                          />
                          {validationErrors[`${node.id}-path`] && (
                            <p className="mt-1 text-[11px] text-rose-400">
                              {validationErrors[`${node.id}-path`]}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 5. HTTP REQUEST */}
                    {type.includes('http') && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-[#e5d8b8] mb-1">
                              Method
                            </label>
                            <select
                              value={cfg.method || 'GET'}
                              onChange={(e) => handleFieldChange(node.id, 'method', e.target.value)}
                              className="w-full rounded-lg border border-purple-500/30 bg-[#1f1830] px-3 py-2 text-xs text-white outline-none focus:border-purple-400"
                            >
                              <option value="GET">GET</option>
                              <option value="POST">POST</option>
                              <option value="PUT">PUT</option>
                              <option value="DELETE">DELETE</option>
                            </select>
                          </div>
                          <div className="col-span-3">
                            <label className="block text-xs font-medium text-[#e5d8b8] mb-1">
                              Endpoint URL *
                            </label>
                            <input
                              type="text"
                              value={cfg.url || ''}
                              onChange={(e) => handleFieldChange(node.id, 'url', e.target.value)}
                              placeholder="https://api.example.com/data"
                              className="w-full rounded-lg border border-purple-500/30 bg-[#1f1830] px-3 py-2 text-xs text-white outline-none focus:border-purple-400"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 6. AI AGENT */}
                    {type.includes('aiagent') && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-[#e5d8b8] mb-1">
                            AI Model
                          </label>
                          <select
                            value={cfg.model || 'gemini-1.5-flash'}
                            onChange={(e) => handleFieldChange(node.id, 'model', e.target.value)}
                            className="w-full rounded-lg border border-purple-500/30 bg-[#1f1830] px-3 py-2 text-xs text-white outline-none focus:border-purple-400"
                          >
                            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                            <option value="gpt-4o-mini">GPT-4o Mini</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#e5d8b8] mb-1">
                            System Instructions
                          </label>
                          <textarea
                            rows={2}
                            value={cfg.systemInstructions || cfg.systemPrompt || ''}
                            onChange={(e) => handleFieldChange(node.id, 'systemInstructions', e.target.value)}
                            className="w-full rounded-lg border border-purple-500/30 bg-[#1f1830] px-3 py-2 text-xs text-white outline-none focus:border-purple-400 resize-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* 7. DELAY / WAIT */}
                    {(type === 'wait' || type === 'delay') && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[#e5d8b8] mb-1">
                            Duration
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={cfg.duration || 5}
                            onChange={(e) => handleFieldChange(node.id, 'duration', Number(e.target.value))}
                            className="w-full rounded-lg border border-purple-500/30 bg-[#1f1830] px-3 py-2 text-xs text-white outline-none focus:border-purple-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#e5d8b8] mb-1">
                            Unit
                          </label>
                          <select
                            value={cfg.unit || 'seconds'}
                            onChange={(e) => handleFieldChange(node.id, 'unit', e.target.value)}
                            className="w-full rounded-lg border border-purple-500/30 bg-[#1f1830] px-3 py-2 text-xs text-white outline-none focus:border-purple-400"
                          >
                            <option value="seconds">Seconds</option>
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* 8. DISCORD / SLACK */}
                    {(type.includes('discord') || type.includes('slack')) && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-[#e5d8b8] mb-1">
                            {type.includes('discord') ? 'Discord Channel ID' : 'Slack Channel'}
                          </label>
                          <input
                            type="text"
                            value={cfg.channelId || cfg.channel || ''}
                            onChange={(e) =>
                              handleFieldChange(node.id, type.includes('discord') ? 'channelId' : 'channel', e.target.value)
                            }
                            placeholder={type.includes('discord') ? 'e.g. 123456789' : '#general'}
                            className="w-full rounded-lg border border-purple-500/30 bg-[#1f1830] px-3 py-2 text-xs text-white outline-none focus:border-purple-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#e5d8b8] mb-1">
                            Message
                          </label>
                          <textarea
                            rows={2}
                            value={cfg.message || ''}
                            onChange={(e) => handleFieldChange(node.id, 'message', e.target.value)}
                            placeholder="Message text or expression..."
                            className="w-full rounded-lg border border-purple-500/30 bg-[#1f1830] px-3 py-2 text-xs text-white outline-none focus:border-purple-400 resize-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-purple-500/20 bg-[#110e1a] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            className="rounded-lg border border-purple-500/20 px-4 py-2 text-xs font-medium text-purple-300/70 hover:bg-purple-500/10 hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={isExecuting}
              className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-[#1b1528] px-4 py-2 text-xs font-medium text-purple-300 hover:bg-[#251d38] transition cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              Apply to Canvas Only
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={isExecuting}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-amber-500 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-purple-600/30 hover:from-purple-500 hover:to-amber-400 transition cursor-pointer disabled:opacity-50"
            >
              {isExecuting ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Apply Details & Execute Workflow</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
