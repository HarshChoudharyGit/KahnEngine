import { useRef, useState } from 'react'
import { Bot, LoaderCircle, Send, Sparkles, X, Wand2 } from 'lucide-react'
import { generateWorkflowFromPrompt } from '../services/api.js'

const EXAMPLE_PROMPTS = [
  'When a GitHub issue is created, send a Gmail notification and a Discord message',
  'Every day at 9 AM, fetch data from an API and send a summary email',
  'When a webhook receives data, check if amount > 100, then send different emails',
  'Monitor GitHub for new PRs, use AI to summarize, and post to Slack',
  'When an email arrives, transform the data and make an HTTP request to a CRM',
]

function AIPromptBar({ onWorkflowGenerated, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [showExamples, setShowExamples] = useState(false)
  const inputRef = useRef(null)

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return
    setError(null)
    setIsGenerating(true)

    try {
      const workflow = await generateWorkflowFromPrompt(prompt.trim())
      onWorkflowGenerated(workflow)
      setPrompt('')
      setIsOpen(false)
      setShowExamples(false)
    } catch (err) {
      setError(err.message || 'Failed to generate workflow')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleGenerate()
    }
    if (e.key === 'Escape') {
      setIsOpen(false)
      setShowExamples(false)
    }
  }

  const handleExampleClick = (example) => {
    setPrompt(example)
    setShowExamples(false)
    inputRef.current?.focus()
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsOpen(true)
          setTimeout(() => inputRef.current?.focus(), 100)
        }}
        disabled={disabled}
        className="group flex items-center gap-2 rounded-lg border border-purple-500/30 bg-gradient-to-r from-[#1a1225]/95 to-[#17120e]/95 px-4 py-2.5 text-sm font-medium text-purple-300 shadow-lg backdrop-blur-sm transition-all hover:border-purple-400/60 hover:shadow-purple-500/15 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        title="Generate workflow with AI"
      >
        <Wand2 className="h-4 w-4 text-purple-400 transition group-hover:text-purple-300" />
        <span className="hidden sm:inline">AI Generate</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Main Input Bar */}
      <div className="relative flex w-[min(42rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-xl border border-purple-500/35 bg-[#14101e]/[.98] shadow-2xl shadow-purple-500/10 backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-purple-500/15 px-4 py-2.5">
          <Bot className="h-4 w-4 text-purple-400" />
          <span className="text-xs font-semibold text-purple-300">AI Workflow Designer</span>
          <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-medium text-purple-400">
            Powered by Groq
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowExamples((v) => !v)}
              className="rounded-md px-2 py-1 text-[11px] text-purple-400/70 transition hover:bg-purple-500/10 hover:text-purple-300 cursor-pointer"
            >
              <Sparkles className="mr-1 inline h-3 w-3" />
              Examples
            </button>
            <button
              type="button"
              aria-label="Close AI prompt"
              onClick={() => {
                setIsOpen(false)
                setShowExamples(false)
                setError(null)
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-purple-400/50 transition hover:bg-purple-500/10 hover:text-purple-300 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Input Area */}
        <div className="flex items-end gap-2 px-4 py-3">
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the workflow you want to create..."
            disabled={isGenerating}
            rows={2}
            className="max-h-28 min-h-[3rem] flex-1 resize-none bg-transparent text-sm leading-relaxed text-[#e5d8b8] placeholder-purple-300/30 outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white shadow-md transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            title="Generate workflow"
          >
            {isGenerating ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="border-t border-rose-500/20 bg-rose-500/5 px-4 py-2.5">
            <p className="text-xs text-rose-300">{error}</p>
          </div>
        )}

        {/* Generating Indicator */}
        {isGenerating && (
          <div className="border-t border-purple-500/15 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-400" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-400" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-400" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-purple-300/70">
                Analyzing your requirements and designing workflow...
              </span>
            </div>
          </div>
        )}

        {/* Example Prompts */}
        {showExamples && !isGenerating && (
          <div className="border-t border-purple-500/15 px-4 py-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-purple-400/50">
              Example prompts
            </p>
            <div className="flex flex-col gap-1.5">
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => handleExampleClick(example)}
                  className="rounded-lg px-3 py-2 text-left text-xs leading-relaxed text-purple-200/70 transition hover:bg-purple-500/8 hover:text-purple-200 cursor-pointer"
                >
                  <Sparkles className="mr-1.5 inline h-3 w-3 text-purple-400/50" />
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AIPromptBar
