import { useEffect, useState } from 'react'
import logo from '../assets/logo.png'
import {
  ArrowRight,
  Braces,
  Bug,
  Check,
  Copy,
  House,
  Layers3,
  LayoutDashboard,
  MoreHorizontal,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import { workflowTemplates } from '../data/workflowTemplates.js'

const resourceLinks = [
  { label: 'Templates', icon: Layers3 },
  { label: 'Variables', icon: Braces },
]

const helpLinks = [
  { label: 'Quickstart', icon: Sparkles },
  { label: 'Report a bug', icon: Bug },
]

const variableExamples = [
  { expression: '{{trigger.body}}', description: 'Incoming trigger payload' },
  { expression: '{{trigger.headers}}', description: 'Incoming request headers' },
  { expression: '{{workflow.name}}', description: 'Current workflow name' },
]

const helpContent = {
  Quickstart: {
    intro: 'Build and test a workflow in a few steps.',
    items: [
      'Add a trigger or action with the + button.',
      'Connect nodes by dragging from one node handle to another.',
      'Select a node to configure it, then choose Test workflow.',
    ],
  },
  Updates: {
    intro: 'Workspace updates',
    items: [
      'Explore workflows from the new template gallery.',
      'Review variable expression examples from the sidebar.',
      'Use Quickstart and Documentation for in-app guidance.',
    ],
  },
  Project: {
    intro: 'Personal is your current local workspace.',
    items: [
      'This demo currently has one workspace and does not sync projects to an account.',
      'Your workflow editor and execution history are available in this workspace.',
    ],
  },
}

// Loads the saved user display name from localStorage with a fallback default
function loadDisplayName() {
  try {
    return window.localStorage.getItem('dormammu-loop-display-name') || 'Sorcerer Supreme'
  } catch (error) {
    console.error('Unable to load the saved profile name.', error)
    return 'Sorcerer Supreme'
  }
}

// Sidebar navigation offering routes, template loading, and utility slide-out drawers
function SideBar({ onGoHome, onGoDashboard, onGoEditor, onLoadTemplate }) {
  const [activePanel, setActivePanel] = useState('')
  const [displayName, setDisplayName] = useState(loadDisplayName)
  const [nameDraft, setNameDraft] = useState(displayName)
  const [bugDescription, setBugDescription] = useState('')
  const [feedback, setFeedback] = useState('')
  const [updateUnread, setUpdateUnread] = useState(true)

  useEffect(() => {
    if (!activePanel) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setActivePanel('')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activePanel])

  // Opens a specified sidebar panel and clears past feedback notices
  const openPanel = (panel) => {
    setFeedback('')
    setActivePanel(panel)
    if (panel === 'Updates') setUpdateUnread(false)
  }

  // Persists the custom display name to localStorage
  const saveProfile = (event) => {
    event.preventDefault()
    const nextName = nameDraft.trim()
    if (!nextName) {
      setFeedback('Enter a name before saving.')
      return
    }

    try {
      window.localStorage.setItem('dormammu-loop-display-name', nextName)
      setDisplayName(nextName)
      setFeedback('Profile name saved in this browser.')
    } catch (error) {
      console.error('Unable to save the profile name.', error)
      setFeedback('The profile name could not be saved in this browser.')
    }
  }

  // Copies variable template expressions to clipboard
  const copyVariable = async (expression) => {
    try {
      await navigator.clipboard.writeText(expression)
      setFeedback('Expression copied.')
    } catch (error) {
      console.error('Unable to copy the variable expression.', error)
      setFeedback('Clipboard access is unavailable. Select and copy the expression instead.')
    }
  }

  // Copies formatted browser environment details and issue description to clipboard
  const copyBugReport = async (event) => {
    event.preventDefault()
    const report = [
      'Dormammu Loop bug report',
      `Page: ${window.location.href}`,
      `Browser: ${navigator.userAgent}`,
      '',
      bugDescription.trim(),
    ].join('\n')

    try {
      await navigator.clipboard.writeText(report)
      setFeedback('Bug report copied. Paste it into your preferred issue tracker.')
    } catch (error) {
      console.error('Unable to copy the bug report.', error)
      setFeedback('Clipboard access is unavailable. You can copy the report text manually.')
    }
  }

  // Clears stored profile name from localStorage and restores default
  const resetProfile = () => {
    try {
      window.localStorage.removeItem('dormammu-loop-display-name')
      setDisplayName('Sorcerer Supreme')
      setNameDraft('Sorcerer Supreme')
      setFeedback('Profile name reset.')
    } catch (error) {
      console.error('Unable to reset the profile name.', error)
      setFeedback('The profile name could not be reset.')
    }
  }

  // Renders the appropriate slide-out drawer content based on active panel
  const renderPanelContent = () => {
    if (activePanel === 'Templates') {
      return (
        <div className="space-y-3">
          <p className="text-xs leading-5 text-[#a9997b]">
            Load a starter workflow onto the canvas. Loading a template replaces the current canvas.
          </p>
          {workflowTemplates.map((template) => (
            <article key={template.id} className="rounded-lg border border-[#8e7139]/25 bg-[#100d0a] p-3">
              <h3 className="text-sm font-medium text-[#f0e5c9]">{template.name}</h3>
              <p className="mt-1 text-xs leading-5 text-[#9d9076]">{template.description}</p>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm('Loading this template will replace the workflow on your canvas. Continue?')) {
                    return
                  }
                  onLoadTemplate(template.id)
                  setActivePanel('')
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#c69b45] px-3 py-2 text-xs font-semibold text-[#21170c] transition hover:bg-[#dfb95f]"
              >
                Load template <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </article>
          ))}
        </div>
      )
    }

    if (activePanel === 'Variables') {
      return (
        <div className="space-y-3">
          <p className="text-xs leading-5 text-[#a9997b]">
            Reference examples for node input templates. Select an expression to copy it.
          </p>
          {variableExamples.map(({ expression, description }) => (
            <button
              type="button"
              key={expression}
              onClick={() => copyVariable(expression)}
              className="flex w-full items-center gap-3 rounded-lg border border-[#8e7139]/25 bg-[#100d0a] p-3 text-left transition hover:border-[#d4ad58]/50"
            >
              <span className="min-w-0 flex-1">
                <code className="block truncate text-xs text-[#f0d58e]">{expression}</code>
                <span className="mt-1 block text-[11px] text-[#9d9076]">{description}</span>
              </span>
              <Copy aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#a9997b]" />
            </button>
          ))}
          <p className="rounded-md border border-[#8e7139]/20 bg-[#17120e] p-3 text-[11px] leading-5 text-[#88795e]">
            Expressions are reference examples in this demo; workflow execution does not resolve them yet.
          </p>
        </div>
      )
    }

    if (activePanel === 'Profile') {
      return (
        <form onSubmit={saveProfile} className="space-y-3">
          <label className="block text-xs text-[#c9b991]">
            Display name
            <input
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              maxLength={48}
              className="mt-2 h-10 w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-3 text-sm text-[#f0e5c9] outline-none focus:border-[#d4ad58]"
            />
          </label>
          <p className="text-[11px] leading-5 text-[#88795e]">
            This local demo profile is stored only in this browser. It is not an account.
          </p>
          <div className="flex gap-2">
            <button type="submit" className="rounded-md bg-[#c69b45] px-3 py-2 text-xs font-semibold text-[#21170c] hover:bg-[#dfb95f]">
              Save name
            </button>
            <button type="button" onClick={resetProfile} className="rounded-md border border-[#8e7139]/35 px-3 py-2 text-xs text-[#c9b991] hover:bg-[#d4ad58]/8">
              Reset
            </button>
          </div>
        </form>
      )
    }

    if (activePanel === 'Report a bug') {
      return (
        <form onSubmit={copyBugReport} className="space-y-3">
          <p className="text-xs leading-5 text-[#a9997b]">
            Enter what happened. We will prepare a report with the current page and browser details for you to copy.
          </p>
          <textarea
            value={bugDescription}
            onChange={(event) => setBugDescription(event.target.value)}
            required
            rows={5}
            placeholder="Describe the issue and how to reproduce it..."
            className="w-full resize-y rounded-md border border-[#8e7139]/35 bg-[#100d0a] p-3 text-xs leading-5 text-[#f0e5c9] outline-none placeholder:text-[#75684f] focus:border-[#d4ad58]"
          />
          <button type="submit" className="inline-flex items-center gap-2 rounded-md bg-[#c69b45] px-3 py-2 text-xs font-semibold text-[#21170c] hover:bg-[#dfb95f]">
            <Copy aria-hidden="true" className="h-3.5 w-3.5" />
            Copy bug report
          </button>
        </form>
      )
    }

    const content = activePanel === 'Project' ? helpContent.Project : helpContent[activePanel]
    if (!content) return null

    return (
      <div>
        <p className="mb-3 text-xs leading-5 text-[#a9997b]">{content.intro}</p>
        <ul className="space-y-2">
          {content.items.map((item) => (
            <li key={item} className="flex gap-2 text-xs leading-5 text-[#c9b991]">
              <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#d4ad58]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        {activePanel === 'Project' && (
          <button
            type="button"
            onClick={() => {
              onGoEditor()
              setActivePanel('')
            }}
            className="mt-4 rounded-md bg-[#c69b45] px-3 py-2 text-xs font-semibold text-[#21170c] hover:bg-[#dfb95f]"
          >
            Open editor
          </button>
        )}
      </div>
    )
  }

  const panelTitle = activePanel === 'Profile' ? 'Profile options' : activePanel

  return (
    <aside className="relative z-30 flex h-screen w-17 shrink-0 flex-col border-r border-[#8e7139]/25 bg-[#17120e] text-[#e5d8b8] md:w-60">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-[#8e7139]/25 px-4">
        <img src={logo} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
        <span className="font-display hidden truncate text-sm font-semibold tracking-wide text-[#f0d58e] md:block">
          Dormammu Loop
        </span>
      </div>

      <nav aria-label="Main navigation" className="sidebar-scroll flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onGoDashboard || onGoHome}
            className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-[#b9aa8d] transition hover:bg-[#d4ad58]/8 hover:text-[#f0d58e]"
            title="Dashboard"
          >
            <LayoutDashboard aria-hidden="true" className="h-4.5 w-4.5 shrink-0" />
            <span className="hidden truncate md:block">Dashboard</span>
          </button>
          <button
            type="button"
            onClick={onGoHome}
            className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-[#b9aa8d] transition hover:bg-[#d4ad58]/8 hover:text-[#f0d58e]"
            title="Landing Home"
          >
            <House aria-hidden="true" className="h-4.5 w-4.5 shrink-0" />
            <span className="hidden truncate md:block">Home</span>
          </button>
        </div>

        <div className="mt-7">
          <p className="hidden px-3 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8f8065] md:block">
            Projects
          </p>
          <button
            type="button"
            onClick={() => openPanel('Project')}
            className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-[#b9aa8d] transition hover:bg-[#d4ad58]/8 hover:text-[#f0d58e]"
            title="Personal project"
          >
            <UserRound aria-hidden="true" className="h-4.5 w-4.5 shrink-0" />
            <span className="hidden truncate md:block">Personal</span>
          </button>
        </div>

        <div className="mt-7 space-y-1">
          {resourceLinks.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => openPanel(label)}
              className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-[#b9aa8d] transition hover:bg-[#d4ad58]/8 hover:text-[#f0d58e]"
              title={label}
            >
              <Icon aria-hidden="true" className="h-4.5 w-4.5 shrink-0" />
              <span className="hidden truncate md:block">{label}</span>
            </button>
          ))}
        </div>

        <div className="mt-7">
          <p className="hidden px-3 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8f8065] md:block">
            Help
          </p>
          <div className="space-y-1">
            {helpLinks.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => openPanel(label)}
                className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-[#b9aa8d] transition hover:bg-[#d4ad58]/8 hover:text-[#f0d58e]"
                title={label}
              >
                <Icon aria-hidden="true" className="h-4.5 w-4.5 shrink-0" />
                <span className="hidden truncate md:block">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => openPanel('Updates')}
          className="mt-5 flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-[#d4ad58] transition hover:bg-[#d4ad58]/8"
          title="Updates"
        >
          <span className="relative shrink-0">
            <Sparkles aria-hidden="true" className="h-4.5 w-4.5" />
            {updateUnread && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#c76c4d] ring-2 ring-[#17120e]" />}
          </span>
          <span className="hidden md:block">{updateUnread ? '1 update' : 'Updates'}</span>
        </button>
      </nav>

      <div className="flex h-17 shrink-0 items-center gap-2 border-t border-[#8e7139]/25 px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d4ad58]/50 bg-[#332719] text-xs font-semibold text-[#f0d58e]">
          {displayName.slice(0, 2).toUpperCase()}
        </div>
        <span className="hidden min-w-0 flex-1 truncate text-xs font-medium text-[#e5d8b8] md:block">
          {displayName}
        </span>
        <button
          type="button"
          aria-label="Profile options"
          onClick={() => {
            setNameDraft(displayName)
            openPanel('Profile')
          }}
          className="hidden h-8 w-8 items-center justify-center rounded-md text-[#a9997b] hover:bg-[#d4ad58]/10 hover:text-[#f0d58e] md:flex"
        >
          <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      {activePanel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActivePanel('')
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="sidebar-panel-title"
            className="flex max-h-[min(80vh,700px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#8e7139]/40 bg-[#17120e] text-[#e5d8b8] shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-[#8e7139]/25 px-5 py-4">
              <h2 id="sidebar-panel-title" className="font-display text-base font-semibold text-[#f0d58e]">
                {panelTitle}
              </h2>
              <button
                type="button"
                aria-label="Close panel"
                onClick={() => setActivePanel('')}
                className="flex h-8 w-8 items-center justify-center rounded-md text-[#a9997b] hover:bg-[#d4ad58]/10 hover:text-[#f0d58e]"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </header>
            <div className="sidebar-scroll overflow-y-auto p-5">
              {renderPanelContent()}
              {feedback && (
                <p role="status" className="mt-4 rounded-md border border-[#8e7139]/25 bg-[#100d0a] px-3 py-2 text-xs text-[#d4ad58]">
                  {feedback}
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </aside>
  )
}

export default SideBar
