import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { nodeOptions } from '../data/editorData.js'

const categories = [
  { id: 'apps', label: 'Apps', matches: (option) => option.category === 'ACTION' },
  { id: 'core', label: 'Core nodes', matches: (option) => option.category !== 'ACTION' },
]

// Modal search panel for browsing, selecting, and dragging workflow nodes onto the canvas
function NodePicker({ onSelect, onClose, onDragStart }) {
  const [query, setQuery] = useState('')
  const searchRef = useRef(null)

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return nodeOptions

    return nodeOptions.filter((option) =>
      [option.title, option.subtitle, option.category]
        .some((value) => value.toLowerCase().includes(normalizedQuery)),
    )
  }, [query])

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  return (
    <section
      aria-label="Add a workflow node"
      className="absolute right-4 top-16 z-20 flex max-h-[min(680px,calc(100%-5rem))] w-[min(360px,calc(100%-2rem))] flex-col overflow-hidden rounded-lg border border-[#45484b] bg-[#25282b] text-[#e4e7e9] shadow-[0_24px_70px_rgba(0,0,0,.55)] sm:right-5"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3.5">
        <h2 className="text-sm font-semibold tracking-wide">What happens next?</h2>
        <button
          type="button"
          aria-label="Close node picker"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded text-[#aeb3b7] transition hover:bg-white/8 hover:text-white"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <label className="relative mx-3 mt-3 flex h-10 items-center rounded-md border border-white/10 bg-[#202326] focus-within:border-[#bc7467]">
        <Search aria-hidden="true" className="ml-3 h-4 w-4 shrink-0 text-[#dc776b]" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search apps and nodes..."
          aria-label="Search apps and nodes"
          className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-xs text-[#f1f2f3] outline-none placeholder:text-[#969ca1]"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery('')}
            className="mr-2 flex h-6 w-6 items-center justify-center rounded text-[#aeb3b7] hover:bg-white/8 hover:text-white"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
      </label>

      <div className="node-picker-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-2">
        {categories.map(({ id, label, matches }) => {
          const options = filteredOptions.filter(matches)
          if (options.length === 0) return null

          return (
            <div key={id} className="mb-2">
              <h3 className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#90969b]">
                {label}
              </h3>
              <ul>
                {options.map((option) => {
                  const Icon = option.icon
                  return (
                    <li key={option.title}>
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => onDragStart(event, option.title)}
                        onClick={() => onSelect(option)}
                        className="group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition hover:bg-[#3a3e42] focus-visible:bg-[#3a3e42] focus-visible:outline-none"
                      >
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/5"
                          style={{ backgroundColor: `${option.accent}24`, color: option.accent }}
                        >
                          <Icon aria-hidden="true" className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-[#e4e7e9] group-hover:text-white">
                            {option.title}
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] text-[#a0a6ab]">
                            {option.subtitle}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
        {filteredOptions.length === 0 && (
          <p className="px-4 py-10 text-center text-xs text-[#a0a6ab]">
            No apps or nodes match “{query}”.
          </p>
        )}
      </div>
      <p className="border-t border-white/8 px-4 py-2.5 text-[10px] text-[#90969b]">
        Demo nodes only · service integrations are not connected
      </p>
    </section>
  )
}

export default NodePicker
