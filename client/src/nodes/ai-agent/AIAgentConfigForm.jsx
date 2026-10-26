import { Bot, Code2, Globe, MessageSquare, Search, Wrench } from 'lucide-react'

const inputClassName = 'mt-1.5 w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-3 py-2.5 text-sm text-[#f0e5c9] outline-none transition placeholder:text-[#756b5a] focus:border-[#c69b45]'

const availableTools = [
  {
    id: 'web_search',
    name: 'Web Search',
    description: 'Searches live web (DuckDuckGo) for real-time facts & docs',
    icon: Search,
  },
  {
    id: 'code_interpreter',
    name: 'Code Interpreter',
    description: 'Evaluates JavaScript for exact math, data parsing & logic',
    icon: Code2,
  },
  {
    id: 'http_request',
    name: 'HTTP / API Caller',
    description: 'Dynamically fetches or posts to external REST APIs',
    icon: Globe,
  },
  {
    id: 'send_alert',
    name: 'Alerts & Messaging',
    description: 'Dispatches notifications to Discord, Slack, or Email',
    icon: MessageSquare,
  },
  {
    id: 'github_action',
    name: 'GitHub Inspector',
    description: 'Queries branches, latest commits, and repo health',
    icon: Bot,
  },
]

// Form component for configuring AI agent models, prompts, temperature, and tool attachments
function AIAgentConfigForm({ value, errors, onChange }) {
  // Updates a single parameter in the AI agent configuration
  const setField = (key, nextValue) => onChange({ ...value, [key]: nextValue })

  const currentTools = Array.isArray(value.tools) ? value.tools : ['web_search', 'code_interpreter', 'http_request']

  // Adds or removes an autonomous reasoning tool from the agent toolset
  const toggleTool = (toolId) => {
    if (currentTools.includes(toolId)) {
      setField('tools', currentTools.filter((t) => t !== toolId))
    } else {
      setField('tools', [...currentTools, toolId])
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="ai-model" className="block text-xs font-medium text-[#c9b991]">Model Engine</label>
        <select
          id="ai-model"
          value={value.model}
          onChange={(event) => setField('model', event.target.value)}
          className={inputClassName}
        >
          <option value="gpt-4o-mini">GPT-4o mini (LangChain / LangGraph)</option>
          <option value="gpt-4o">GPT-4o (High Reasoning)</option>
          <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
        </select>
      </div>

      <div>
        <label htmlFor="ai-system-instructions" className="block text-xs font-medium text-[#c9b991]">
          System instructions<span className="ml-1 text-[#d98a74]">*</span>
        </label>
        <textarea
          id="ai-system-instructions"
          value={value.systemInstructions}
          onChange={(event) => setField('systemInstructions', event.target.value)}
          rows={3}
          placeholder="Define the agent role, behavior, and constraints..."
          aria-invalid={Boolean(errors.systemInstructions)}
          className={inputClassName}
        />
        {errors.systemInstructions && <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.systemInstructions}</p>}
      </div>

      <div>
        <label htmlFor="ai-prompt" className="block text-xs font-medium text-[#c9b991]">
          User prompt / input template<span className="ml-1 text-[#d98a74]">*</span>
        </label>
        <textarea
          id="ai-prompt"
          value={value.prompt}
          onChange={(event) => setField('prompt', event.target.value)}
          rows={3}
          placeholder="Summarize this incoming event: {{trigger.body}} and verify with web search..."
          aria-invalid={Boolean(errors.prompt)}
          className={inputClassName}
        />
        {errors.prompt && <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.prompt}</p>}
      </div>

      {/* LangGraph Enabled Tools Section */}
      <div className="rounded-lg border border-[#8e7139]/30 bg-[#14100c] p-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#d4ad58]">
            <Wrench className="h-3.5 w-3.5" />
            LangGraph Agent Tools
          </div>
          <span className="text-[10px] text-[#88795e]">
            {currentTools.length} enabled
          </span>
        </div>
        <p className="mb-3 text-[11px] text-[#9d9076]">
          Tools the Agent can autonomously invoke during its ReAct loop.
        </p>

        <div className="space-y-2">
          {availableTools.map((tool) => {
            const isEnabled = currentTools.includes(tool.id)
            const ToolIcon = tool.icon

            return (
              <label
                key={tool.id}
                className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 transition ${
                  isEnabled
                    ? 'border-[#d4ad58]/50 bg-[#1d1610]'
                    : 'border-[#8e7139]/20 bg-[#100d0a]/60 opacity-60 hover:opacity-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => toggleTool(tool.id)}
                  className="mt-0.5 h-4 w-4 accent-[#c69b45]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <ToolIcon className="h-3.5 w-3.5 text-[#d4ad58]" />
                    <span className="text-xs font-medium text-[#f0e5c9]">{tool.name}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#8f8065]">{tool.description}</p>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ai-temperature" className="block text-xs font-medium text-[#c9b991]">Temperature</label>
          <input
            id="ai-temperature"
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={value.temperature ?? 0.7}
            onChange={(event) => setField('temperature', Number(event.target.value))}
            aria-invalid={Boolean(errors.temperature)}
            className={inputClassName}
          />
          {errors.temperature && <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.temperature}</p>}
        </div>

        <div>
          <label htmlFor="ai-max-tokens" className="block text-xs font-medium text-[#c9b991]">Max Tokens</label>
          <input
            id="ai-max-tokens"
            type="number"
            min="1"
            max="128000"
            step="1"
            value={value.maxOutputTokens ?? 1000}
            onChange={(event) => setField('maxOutputTokens', Number(event.target.value))}
            aria-invalid={Boolean(errors.maxOutputTokens)}
            className={inputClassName}
          />
          {errors.maxOutputTokens && <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.maxOutputTokens}</p>}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-[#8e7139]/25 bg-[#100d0a]/70 px-3 py-2.5 text-xs text-[#c9b991]">
        <input
          type="checkbox"
          checked={value.structuredOutput}
          onChange={(event) => setField('structuredOutput', event.target.checked)}
          className="h-4 w-4 accent-[#c69b45]"
        />
        Require structured JSON output
      </label>

      {value.structuredOutput && (
        <div>
          <label htmlFor="ai-output-schema" className="block text-xs font-medium text-[#c9b991]">
            JSON schema<span className="ml-1 text-[#d98a74]">*</span>
          </label>
          <textarea
            id="ai-output-schema"
            value={value.outputSchema}
            onChange={(event) => setField('outputSchema', event.target.value)}
            rows={4}
            placeholder='{"type":"object","properties":{}}'
            aria-invalid={Boolean(errors.outputSchema)}
            className={inputClassName}
          />
          {errors.outputSchema && <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.outputSchema}</p>}
        </div>
      )}
    </div>
  )
}

export default AIAgentConfigForm
