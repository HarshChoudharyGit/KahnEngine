import { MoreHorizontal, Plus, RotateCcw } from 'lucide-react'

const Header = ({ activeTab, onTabChange }) => {
  return (
    <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-[#8e7139]/25 bg-[#17120e] px-3 text-sm text-[#e5d8b8] sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="truncate rounded px-2 py-1.5 font-medium text-[#f0e5c9] transition hover:bg-[#d4ad58]/8"
          aria-label="Edit workflow name"
        >
          My workflow
        </button>
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
            key={tab}
            type="button"
            aria-pressed={activeTab === tab}
            onClick={() => onTabChange(tab)}
            className={`rounded px-3 py-1.5 text-xs transition ${
              activeTab === tab
                ? 'font-medium text-[#f0d58e] shadow-sm'
                : 'text-[#9d9076] hover:text-[#e5d8b8]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          className="hidden items-center gap-2 text-xs text-[#b9aa8d] transition hover:text-[#f0d58e] md:flex"
          aria-label="Workflow is inactive"
        >
          Inactive
          <span className="flex h-4.5 w-9 items-center rounded-full border border-[#8e7139]/40 bg-[#2a2118] px-0.5">
            <span className="h-3.5 w-3.5 rounded-full bg-[#b9aa8d]" />
          </span>
        </button>
        <button
          type="button"
          className="rounded-md border border-[#8e7139]/45 px-3 py-1.5 text-xs font-medium text-[#e5d8b8] transition hover:border-[#d4ad58]/70 hover:bg-[#d4ad58]/8"
        >
          Share
        </button>
        <span className="hidden items-center gap-1.5 px-1 text-xs text-[#a9997b] lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#d4ad58] shadow-[0_0_8px_rgba(212,173,88,0.65)]" />
          Saved
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
