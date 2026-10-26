import { useState } from 'react'
import { Check, LoaderCircle, MoreHorizontal, Plus, RotateCcw, Save } from 'lucide-react'

// Top navigation header bar for workflow management, tab toggling, and persistence
const Header = ({
  activeTab,
  onTabChange,
  workflowTitle = 'My workflow',
  onWorkflowTitleChange,
  onSave,
  isSaving = false,
  saveStatus = 'saved',
  isActive = false,
  onToggleActive,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(workflowTitle)

  // Commits title changes when user presses Enter or submits the title form
  const handleTitleSubmit = (e) => {
    e.preventDefault()
    if (titleDraft.trim()) {
      onWorkflowTitleChange?.(titleDraft.trim())
    }
    setIsEditingTitle(false)
  }

  return (
    <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-[#8e7139]/25 bg-[#17120e] px-3 text-sm text-[#e5d8b8] sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        {isEditingTitle ? (
          <form onSubmit={handleTitleSubmit} className="flex items-center gap-1.5">
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                if (titleDraft.trim()) onWorkflowTitleChange?.(titleDraft.trim())
                setIsEditingTitle(false)
              }}
              autoFocus
              className="rounded border border-[#d4ad58] bg-[#100d0a] px-2 py-1 text-sm font-medium text-[#f0e5c9] outline-none"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setTitleDraft(workflowTitle)
              setIsEditingTitle(true)
            }}
            className="truncate rounded px-2 py-1.5 font-medium text-[#f0e5c9] transition hover:bg-[#d4ad58]/8"
            aria-label="Edit workflow name"
          >
            {workflowTitle}
          </button>
        )}

        <button
          type="button"
          className="hidden items-center gap-1 rounded px-2 py-1.5 text-xs text-[#a9997b] transition hover:bg-[#d4ad58]/8 hover:text-[#e5d8b8] sm:flex"
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
          Add tag
        </button>
      </div>

      <div className="absolute left-[45%] hidden -translate-x-1/2 items-center rounded-md border border-[#8e7139]/25 bg-[#100d0a]/70 p-0.5 sm:flex">
        {[
          ['editor', 'Editor'],
          ['executions', 'Executions'],
        ].map(([tab, label]) => (
          <button
            id={`tab-${tab}-btn`}
            key={tab}
            type="button"
            aria-pressed={activeTab === tab}
            onClick={() => onTabChange(tab)}
            className={`rounded px-3 py-1.5 text-xs transition ${activeTab === tab
                ? 'font-medium text-[#f0d58e] shadow-sm bg-[#d4ad58]/10'
                : 'text-[#9d9076] hover:text-[#e5d8b8]'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        {onToggleActive && (
          <button
            type="button"
            onClick={onToggleActive}
            className={`hidden items-center gap-2 text-xs transition md:flex ${isActive ? 'text-emerald-400' : 'text-[#b9aa8d] hover:text-[#f0d58e]'
              }`}
            aria-label={`Workflow is ${isActive ? 'active' : 'inactive'}`}
          >
            {isActive ? 'Active' : 'Inactive'}
            <span className={`flex h-4.5 w-9 items-center rounded-full border px-0.5 transition ${isActive ? 'border-emerald-600 bg-emerald-950/60' : 'border-[#8e7139]/40 bg-[#2a2118]'
              }`}>
              <span className={`h-3.5 w-3.5 rounded-full transition-transform ${isActive ? 'translate-x-4 bg-emerald-400' : 'bg-[#b9aa8d]'
                }`} />
            </span>
          </button>
        )}

        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-md border border-[#8e7139]/45 px-3 py-1.5 text-xs font-medium text-[#e5d8b8] transition hover:border-[#d4ad58]/70 hover:bg-[#d4ad58]/8 disabled:opacity-50"
          >
            {isSaving ? (
              <LoaderCircle className="h-3 w-3 animate-spin text-[#d4ad58]" />
            ) : (
              <Save className="h-3 w-3 text-[#d4ad58]" />
            )}
            <span>{isSaving ? 'Saving…' : 'Save'}</span>
          </button>
        )}

        <span className="hidden items-center gap-1.5 px-1 text-xs text-[#a9997b] lg:flex">
          <span className={`h-1.5 w-1.5 rounded-full ${saveStatus === 'saved'
              ? 'bg-[#d4ad58] shadow-[0_0_8px_rgba(212,173,88,0.65)]'
              : saveStatus === 'unsaved'
                ? 'bg-amber-400'
                : 'bg-rose-400'
            }`} />
          {saveStatus === 'saved' ? 'Saved' : saveStatus === 'unsaved' ? 'Unsaved' : 'Save Error'}
        </span>

        <button
          type="button"
          aria-label="Undo"
          className="hidden h-8 w-8 items-center justify-center rounded-md text-[#a9997b] transition hover:bg-[#d4ad58]/8 hover:text-[#f0d58e] sm:flex"
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="More workflow options"
          className="flex h-8 w-8 items-center justify-center rounded-md text-[#a9997b] transition hover:bg-[#d4ad58]/8 hover:text-[#f0d58e]"
        >
          <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}

export default Header
