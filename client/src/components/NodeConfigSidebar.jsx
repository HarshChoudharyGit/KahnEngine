import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, AlertTriangle, Check, Sparkles, Trash2, X } from 'lucide-react'
import { getNodeConfigSchema } from '../nodes/nodeConfigRegistry.js'
import NodeConfigForm from './NodeConfigForm.jsx'

function NodeConfigPanel({ node, nodes, edges, onClose, onDelete, onSave, onInvalidSave }) {
  const configType = node.data?.configType || node.data?.type || node.type || node.data?.title
  const schema = getNodeConfigSchema(configType)
  const ConfigForm = schema.Form ?? NodeConfigForm
  const [draft, setDraft] = useState(() => ({
    ...schema.fields.reduce((defaults, field) => {
      if (field.key in (schema.defaults ?? {})) return defaults
      if (field.defaultValue !== undefined) defaults[field.key] = field.defaultValue
      else if (field.type === 'select') defaults[field.key] = field.options?.[0]?.value ?? ''
      else if (field.type === 'checkbox') defaults[field.key] = false
      else if (field.type === 'multiselect') defaults[field.key] = []
      else if (field.type === 'keyValue') defaults[field.key] = [{ key: '', value: '' }]
      else if (field.type === 'number') defaults[field.key] = 1
      else if (field.type !== 'integration') defaults[field.key] = ''
      return defaults
    }, { ...(schema.defaults ?? {}) }),
    ...(!node.data.configType
      ? { title: node.data.title, subtitle: node.data.subtitle }
      : {}),
    ...(node.data.configuration ?? {}),
  }))

  const initialSnapshotRef = useRef(JSON.stringify(draft))
  const [errors, setErrors] = useState({})
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const reducedMotion = useReducedMotion()

  const isDirty = JSON.stringify(draft) !== initialSnapshotRef.current

  const handleRequestClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true)
    } else {
      onClose()
    }
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false)
        } else if (isDirty) {
          setShowDiscardConfirm(true)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDirty, onClose, showDiscardConfirm])

  const handleSave = (event) => {
    event.preventDefault()
    let validationErrors = {}
    try {
      validationErrors = typeof schema.validate === 'function' ? schema.validate(draft) : {}
    } catch (err) {
      console.warn('Form validation error:', err)
      validationErrors = { form: 'Configuration needs review.' }
    }
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) {
      onInvalidSave(node.id)
      return
    }
    initialSnapshotRef.current = JSON.stringify(draft)
    onSave(node.id, draft)
  }

  const accentColor = node.data?.accent || '#d4ad58'

  return (
    <motion.aside
      initial={reducedMotion ? false : { x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      aria-label={`${schema.label} configuration`}
      className="absolute inset-y-0 right-0 z-30 flex w-full max-w-[460px] flex-col border-l border-[#8e7139]/35 bg-[#17120e]/[.98] text-[#e5d8b8] shadow-[-24px_0_70px_rgba(0,0,0,.45)] backdrop-blur-xl overflow-x-hidden"
      onClick={(event) => event.stopPropagation()}
    >
      <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
        {/* Header with Hierarchy */}
        <header className="flex shrink-0 items-start justify-between border-b border-[#8e7139]/25 px-5 py-4">
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black"
                style={{ backgroundColor: accentColor }}
              >
                <Sparkles className="h-2.5 w-2.5" />
                {node.data?.category || schema.category || 'ACTION'}
              </span>
              <span className="text-[10px] font-medium tracking-wide text-[#a9997b]">
                Node ID: {node.id}
              </span>
            </div>
            <h2 className="mt-2 truncate text-base font-semibold text-[#f0d58e]">{node.data.title}</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-[#9f927b]">{schema.description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Delete node"
              title="Delete node from workflow"
              onClick={() => onDelete(node.id)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#a9997b] transition hover:bg-[#8f4d3b]/15 hover:text-[#e18a7a]"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Close configuration"
              title="Close panel"
              onClick={handleRequestClose}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#a9997b] transition hover:bg-white/5 hover:text-[#f0d58e]"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Unsaved Changes Discard Confirmation Banner */}
        {showDiscardConfirm && (
          <div className="shrink-0 border-b border-amber-500/30 bg-[#251c12] p-4 text-xs text-[#f0d58e] animate-in fade-in duration-150">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-amber-300">Discard unsaved changes?</p>
                <p className="mt-0.5 text-[11px] text-[#c9b991]">
                  You have made changes that have not been saved yet. Closing now will discard them.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="cursor-pointer rounded bg-rose-900/40 border border-rose-700/50 px-2.5 py-1 text-[11px] font-medium text-rose-200 transition hover:bg-rose-900/60"
                  >
                    Discard changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDiscardConfirm(false)}
                    className="cursor-pointer rounded border border-[#8e7139]/40 bg-[#17120e] px-2.5 py-1 text-[11px] font-medium text-[#c9b991] transition hover:bg-white/5 hover:text-[#f0e5c9]"
                  >
                    Keep editing
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {node.data.configurationStatus === 'error' && (
            <p className="mb-4 flex items-center gap-2 rounded-md border border-[#a34f42]/30 bg-[#8f4d3b]/10 px-3 py-2 text-xs text-[#e18a7a]">
              <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
              Configuration needs attention. Review the highlighted fields.
            </p>
          )}
          <ConfigForm
            schema={schema}
            node={node}
            nodes={nodes}
            edges={edges}
            value={draft}
            errors={errors}
            onChange={(nextValue) => {
              setDraft(nextValue)
              if (Object.keys(errors).length > 0) {
                setErrors(schema.validate(nextValue))
              }
            }}
          />
        </div>

        {/* Footer with Clear Status and Action Buttons */}
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#8e7139]/25 bg-[#17120e] px-5 py-3.5">
          <div className="text-[11px]">
            {isDirty ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                Unsaved changes
              </span>
            ) : node.data.configurationStatus === 'configured' ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                <Check aria-hidden="true" className="h-3.5 w-3.5" />
                Configured & saved
              </span>
            ) : (
              <span className="text-[#81745f]">Not configured</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRequestClose}
              className="cursor-pointer rounded-md border border-[#8e7139]/35 px-3 py-1.5 text-xs font-medium text-[#c9b991] transition hover:bg-white/5 hover:text-[#f0e5c9]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cursor-pointer rounded-md bg-[#c69b45] px-3.5 py-1.5 text-xs font-semibold text-[#21170c] transition hover:bg-[#dfb95f]"
            >
              Save configuration
            </button>
          </div>
        </footer>
      </form>
    </motion.aside>
  )
}

function NodeConfigSidebar({ node, ...props }) {
  return (
    <AnimatePresence>
      {node && <NodeConfigPanel key={node.id} node={node} {...props} />}
    </AnimatePresence>
  )
}

export default NodeConfigSidebar
