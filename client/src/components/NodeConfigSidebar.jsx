import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, Check, Trash2, X } from 'lucide-react'
import { getNodeConfigSchema } from '../nodes/nodeConfigRegistry.js'
import NodeConfigForm from './NodeConfigForm.jsx'

// Slide-out panel for inspecting and editing a selected node's configuration
function NodeConfigPanel({ node, onClose, onDelete, onSave, onInvalidSave, workflowId }) {
  const schema = getNodeConfigSchema(node.data.configType)
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
    _nodeId: node.id,
    _workflowId: workflowId,
  }))
  const [errors, setErrors] = useState({})
  const reducedMotion = useReducedMotion()

  // Closes the configuration sidebar when the Escape key is pressed
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Validates form input against schema rules and saves valid configuration to workflow state
  const handleSave = (event) => {
    event.preventDefault()
    const validationErrors = schema.validate(draft)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) {
      onInvalidSave(node.id)
      return
    }
    const { _nodeId, _workflowId, ...cleanedDraft } = draft
    onSave(node.id, cleanedDraft)
  }

  return (
    <motion.aside
      initial={reducedMotion ? false : { x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      aria-label={`${schema.label} configuration`}
      className="absolute inset-y-0 right-0 z-30 flex w-full max-w-[440px] flex-col border-l border-[#8e7139]/35 bg-[#17120e]/[.98] text-[#e5d8b8] shadow-[-24px_0_70px_rgba(0,0,0,.45)] backdrop-blur-xl"
      onClick={(event) => event.stopPropagation()}
    >
      <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-start justify-between border-b border-[#8e7139]/25 px-5 py-5">
          <div className="min-w-0 pr-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a9997b]">
              Kamar-Taj · Node configuration
            </p>
            <h2 className="mt-2 truncate text-lg font-semibold text-[#f0d58e]">{node.data.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#9f927b]">{schema.description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Delete node"
              onClick={() => onDelete(node.id)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-[#a9997b] transition hover:bg-[#8f4d3b]/15 hover:text-[#e18a7a]"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Close configuration"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-md text-[#a9997b] transition hover:bg-white/5 hover:text-[#f0d58e]"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {node.data.configurationStatus === 'error' && (
            <p className="mb-5 flex items-center gap-2 rounded-md border border-[#a34f42]/30 bg-[#8f4d3b]/10 px-3 py-2.5 text-xs text-[#e18a7a]">
              <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
              Configuration needs attention. Review the highlighted fields.
            </p>
          )}
          <ConfigForm
            schema={schema}
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

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#8e7139]/25 bg-[#17120e] px-5 py-4">
          <span className="text-[11px] text-[#81745f]">
            {node.data.configurationStatus === 'configured'
              ? <span className="inline-flex items-center gap-1.5 text-emerald-300"><Check aria-hidden="true" className="h-3.5 w-3.5" /> Saved</span>
              : 'Unsaved configuration'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#8e7139]/35 px-3.5 py-2 text-xs font-medium text-[#c9b991] transition hover:bg-white/5 hover:text-[#f0e5c9]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-[#c69b45] px-4 py-2 text-xs font-semibold text-[#21170c] transition hover:bg-[#dfb95f]"
            >
              Save configuration
            </button>
          </div>
        </footer>
      </form>
    </motion.aside>
  )
}

// AnimatePresence wrapper that mounts/unmounts NodeConfigPanel smoothly when a node is selected
function NodeConfigSidebar({ node, ...props }) {
  return (
    <AnimatePresence>
      {node && <NodeConfigPanel key={node.id} node={node} {...props} />}
    </AnimatePresence>
  )
}

export default NodeConfigSidebar
