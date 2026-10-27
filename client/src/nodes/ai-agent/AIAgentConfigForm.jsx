import { useMemo, useState, useRef } from 'react'
import {
  AlertCircle,
  Bot,
  BrainCircuit,
  Calculator,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  FileJson,
  Globe,
  History,
  Layers,
  Search,
  Sliders,
  Sparkles,
  Variable,
  Wrench,
} from 'lucide-react'

const inputClassName =
  'mt-1.5 w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-3 py-2.5 text-sm text-[#f0e5c9] outline-none transition placeholder:text-[#756b5a] focus:border-[#c69b45]'

const IMPLEMENTED_TOOLS = [
  {
    id: 'web_search',
    name: 'Web Search',
    description: 'Searches live web (DuckDuckGo Instant Answers) for real-time facts & docs',
    icon: Search,
  },
  {
    id: 'http_request',
    name: 'HTTP / API Caller',
    description: 'Fetches or posts to external REST APIs with SSRF protection and timeout limits',
    icon: Globe,
  },
  {
    id: 'calculator',
    name: 'Safe Calculator',
    description: 'Evaluates arithmetic and math expressions safely without arbitrary code execution',
    icon: Calculator,
  },
  {
    id: 'github_action',
    name: 'GitHub Inspector',
    description: 'Queries branches, latest commits, and creates issues via authenticated Octokit',
    icon: Bot,
  },
]

const SYSTEM_PRESETS = [
  {
    label: 'General Assistant',
    instructions:
      'You are a production-ready AI assistant in the Kahn Engine distributed pipeline. Follow instructions carefully and deliver clear, accurate responses.',
  },
  {
    label: 'Data Summarizer',
    instructions:
      'You are an executive summarization engine. Analyze the provided data, identify key takeaways, highlights, anomalies, and deliver a concise, actionable summary.',
  },
  {
    label: 'Structured Extractor',
    instructions:
      'You are a high-precision structured data extraction engine. Extract all relevant entities, fields, and metrics from the input and format them strictly according to the required schema.',
  },
  {
    label: 'Text Classifier',
    instructions:
      'You are a categorization and classification engine. Analyze the incoming text, assign appropriate categories, confidence ratings, and sentiment, and justify the classification.',
  },
]

const SCHEMA_TEMPLATES = [
  {
    label: 'Object Summary',
    schema: JSON.stringify(
      {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Brief executive summary' },
          keyPoints: { type: 'array', items: { type: 'string' } },
          sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
        },
        required: ['summary', 'keyPoints'],
      },
      null,
      2
    ),
  },
  {
    label: 'Email Content',
    schema: JSON.stringify(
      {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Email subject line' },
          emailBody: { type: 'string', description: 'Formatted email body text' },
          recipient: { type: 'string', description: 'Recommended recipient email' },
          priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
        },
        required: ['subject', 'emailBody'],
      },
      null,
      2
    ),
  },
  {
    label: 'Classification',
    schema: JSON.stringify(
      {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Classification category' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          urgency: { type: 'string', enum: ['low', 'medium', 'high'] },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['category', 'confidence'],
      },
      null,
      2
    ),
  },
]

function AIAgentConfigForm({ node, nodes = [], edges = [], value = {}, errors = {}, onChange }) {
  const [showVariableDrawer, setShowVariableDrawer] = useState(false)
  const [activeSection, setActiveSection] = useState('prompt') // 'prompt' | 'parameters' | 'tools' | 'schema'
  const promptTextareaRef = useRef(null)

  const setField = (key, nextValue) => {
    onChange({ ...value, [key]: nextValue })
  }

  // Predecessor nodes connected via incoming edges
  const predecessorNodes = useMemo(() => {
    if (!edges || !nodes || !node) return []
    const incomingEdgeSourceIds = edges
      .filter((e) => e.target === node.id)
      .map((e) => e.source)
    return nodes.filter((n) => incomingEdgeSourceIds.includes(n.id))
  }, [edges, nodes, node])

  // Extract variable options from predecessor nodes and global trigger
  const variableGroups = useMemo(() => {
    const groups = []

    // Connected Predecessors
    if (predecessorNodes.length > 0) {
      for (const pred of predecessorNodes) {
        const pId = pred.id
        const title = pred.data?.title || pred.data?.label || pId
        const type = (pred.data?.configType || pred.data?.type || pred.type || '').toLowerCase()

        const items = []
        if (type.includes('http')) {
          items.push(
            { label: 'HTTP Response Data', expr: `{{nodes.${pId}.output.data}}`, desc: 'Parsed JSON response body' },
            { label: 'HTTP Status Code', expr: `{{nodes.${pId}.output.status}}`, desc: 'HTTP response status code (e.g. 200)' },
            { label: 'Raw Response Text', expr: `{{nodes.${pId}.output.text}}`, desc: 'Raw body as string' }
          )
        } else if (type.includes('ai') || type.includes('agent')) {
          items.push(
            { label: 'AI Text Response', expr: `{{nodes.${pId}.output.text}}`, desc: 'Generated text response' },
            { label: 'Structured JSON', expr: `{{nodes.${pId}.output.structured}}`, desc: 'Parsed structured JSON output' },
            { label: 'Response Data', expr: `{{nodes.${pId}.output.data}}`, desc: 'Parsed data payload' },
            { label: 'Model Identifier', expr: `{{nodes.${pId}.output.model}}`, desc: 'Model that generated output' }
          )
        } else if (type.includes('trigger') || type.includes('webhook')) {
          items.push(
            { label: 'Trigger Body', expr: '{{trigger.body}}', desc: 'Incoming webhook/event body' },
            { label: 'Trigger Sender', expr: '{{trigger.sender}}', desc: 'Sender email or ID' },
            { label: 'Repository', expr: '{{trigger.repository}}', desc: 'Repository name if applicable' }
          )
        } else if (type.includes('condition')) {
          items.push(
            { label: 'Condition Result', expr: `{{nodes.${pId}.output.result}}`, desc: 'Boolean evaluation outcome (true/false)' },
            { label: 'Condition Branch', expr: `{{nodes.${pId}.output.branch}}`, desc: 'Branch taken ("true" or "false")' }
          )
        } else {
          items.push(
            { label: 'Node Output', expr: `{{nodes.${pId}.output}}`, desc: 'Complete output payload' }
          )
        }

        groups.push({
          group: `${title} (${pId})`,
          isPredecessor: true,
          items,
        })
      }
    }

    // Trigger variables
    groups.push({
      group: 'Workflow Trigger Payload',
      isPredecessor: false,
      items: [
        { label: 'Trigger Body', expr: '{{trigger.body}}', desc: 'Full incoming payload' },
        { label: 'Sender', expr: '{{trigger.sender}}', desc: 'Sender or user ID' },
        { label: 'Repository', expr: '{{trigger.repository}}', desc: 'GitHub repository or resource' },
        { label: 'Subject', expr: '{{trigger.subject}}', desc: 'Trigger subject or title' },
      ],
    })

    return groups
  }, [predecessorNodes])

  // Insert a variable expression into user prompt
  const insertVariableIntoPrompt = (expr) => {
    const current = value.prompt || ''
    const textarea = promptTextareaRef.current
    if (textarea) {
      const start = textarea.selectionStart || current.length
      const end = textarea.selectionEnd || current.length
      const next = current.slice(0, start) + expr + current.slice(end)
      setField('prompt', next)
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + expr.length, start + expr.length)
      }, 50)
    } else {
      setField('prompt', current ? `${current} ${expr}` : expr)
    }
  }

  // Current tools
  const currentTools = Array.isArray(value.tools) ? value.tools : []
  const toggleTool = (toolId) => {
    if (currentTools.includes(toolId)) {
      setField('tools', currentTools.filter((t) => t !== toolId))
    } else {
      setField('tools', [...currentTools, toolId])
    }
  }

  // Schema validation status
  const schemaValidation = useMemo(() => {
    if (!value.structuredOutput) return null
    if (!value.outputSchema || !value.outputSchema.trim()) {
      return { valid: false, message: 'JSON schema is required when structured output is enabled.' }
    }
    try {
      JSON.parse(value.outputSchema)
      return { valid: true, message: 'Valid JSON Schema' }
    } catch (err) {
      return { valid: false, message: `Syntax Error: ${err.message}` }
    }
  }, [value.structuredOutput, value.outputSchema])

  return (
    <div className="space-y-5">
      {/* Node Name */}
      <div>
        <label htmlFor="ai-node-title" className="block text-xs font-medium text-[#c9b991]">
          Node Name<span className="ml-1 text-[#d98a74]">*</span>
        </label>
        <input
          id="ai-node-title"
          type="text"
          value={value.title || value.nodeName || node?.data?.title || 'AI Agent'}
          onChange={(event) => {
            setField('title', event.target.value)
            setField('nodeName', event.target.value)
          }}
          placeholder="e.g. Lead Summarizer, Data Classifier"
          className={inputClassName}
        />
        {errors.title && <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.title}</p>}
      </div>

      {/* Model & Provider Selection */}
      <div className="rounded-lg border border-[#8e7139]/30 bg-[#14100c] p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#d4ad58]">
            <BrainCircuit className="h-3.5 w-3.5" />
            Model & Provider
          </span>
          <span className="rounded bg-[#8e7139]/20 px-2 py-0.5 text-[10px] font-mono text-[#d4ad58]">
            Google Gemini
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ai-provider" className="block text-xs font-medium text-[#c9b991]">
              Provider
            </label>
            <select
              id="ai-provider"
              value={value.provider || 'gemini'}
              onChange={(e) => setField('provider', e.target.value)}
              className={inputClassName}
            >
              <option value="gemini">Google Gemini</option>
            </select>
          </div>

          <div>
            <label htmlFor="ai-model" className="block text-xs font-medium text-[#c9b991]">
              Gemini Model
            </label>
            <select
              id="ai-model"
              value={value.model || 'gemini-3.5-flash'}
              onChange={(event) => setField('model', event.target.value)}
              className={inputClassName}
            >
              <option value="gemini-3.5-flash">Gemini 3.5 Flash (Fast & reliable - Recommended)</option>
              <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite (Ultra-fast)</option>
              <option value="gemini-3.8-flash">Gemini 3.8 Flash (High Reasoning)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Upstream Variable Picker */}
      <div className="rounded-lg border border-[#8e7139]/30 bg-[#14100c] p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#d4ad58]">
            <Variable className="h-3.5 w-3.5" />
            Upstream Dynamic Variables
          </div>
          <span className="text-[11px] text-[#8e7139]">
            {predecessorNodes.length} connected
          </span>
        </div>

        {predecessorNodes.length === 0 ? (
          <p className="text-[11px] text-[#8f8065] leading-relaxed">
            Connect nodes upstream on the canvas to reference their dynamic outputs (e.g.{' '}
            <code className="text-[#e5cf9b]">{'{{nodes.httpRequest1.output.data}}'}</code>).
          </p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-[11px] text-[#9d9076]">
              Click a variable chip to insert it into your user prompt:
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {variableGroups
                .flatMap((g) => g.items)
                .slice(0, 4)
                .map((item) => (
                  <button
                    key={item.expr}
                    type="button"
                    onClick={() => insertVariableIntoPrompt(item.expr)}
                    title={item.desc}
                    className="inline-flex items-center gap-1 rounded bg-[#1f1912] border border-[#8e7139]/40 px-2 py-1 text-[11px] font-mono text-[#e5cf9b] hover:border-[#c69b45] hover:bg-[#c69b45]/15 transition"
                  >
                    <span>+</span>
                    <span>{item.label}</span>
                  </button>
                ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowVariableDrawer(!showVariableDrawer)}
          className="flex items-center gap-1 text-[11px] text-[#c69b45] hover:text-[#f0e5c9] transition font-medium"
        >
          {showVariableDrawer ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <span>{showVariableDrawer ? 'Hide variable explorer' : 'View all available upstream variables...'}</span>
        </button>

        {showVariableDrawer && (
          <div className="mt-2 rounded-md border border-[#8e7139]/35 bg-[#100d0a] p-3 text-xs space-y-3 max-h-52 overflow-y-auto">
            {variableGroups.map((grp) => (
              <div key={grp.group} className="space-y-1.5">
                <div className="text-[11px] font-semibold text-[#a9997b] flex items-center justify-between border-b border-[#8e7139]/20 pb-1">
                  <span>{grp.group}</span>
                  {grp.isPredecessor && (
                    <span className="text-[10px] text-emerald-400 font-normal">Connected Upstream</span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {grp.items.map((item) => (
                    <div
                      key={item.expr}
                      className="flex items-center justify-between rounded p-1.5 bg-[#17120e] hover:bg-[#201912] border border-[#8e7139]/20 transition"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-[11px] font-medium text-[#f0e5c9]">{item.label}</p>
                        <p className="text-[10px] font-mono text-[#a9997b] truncate">{item.expr}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => insertVariableIntoPrompt(item.expr)}
                        className="shrink-0 rounded bg-[#c69b45]/20 hover:bg-[#c69b45] hover:text-[#21170c] text-[#e5cf9b] px-2 py-0.5 text-[10px] font-medium transition"
                      >
                        Insert
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System Instructions */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="ai-system-instructions" className="block text-xs font-medium text-[#c9b991]">
            System instructions<span className="ml-1 text-[#d98a74]">*</span>
          </label>
          <span className="text-[10px] text-[#756b5a]">Presets:</span>
        </div>

        <div className="mb-2 flex flex-wrap gap-1">
          {SYSTEM_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setField('systemInstructions', preset.instructions)}
              className="rounded bg-[#1a140f] border border-[#8e7139]/30 px-2 py-0.5 text-[10px] text-[#c9b991] hover:border-[#c69b45] hover:text-[#f0e5c9] transition"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <textarea
          id="ai-system-instructions"
          value={value.systemInstructions ?? ''}
          onChange={(event) => setField('systemInstructions', event.target.value)}
          rows={3}
          placeholder="Define the role, constraints, tone, and operational guidelines..."
          aria-invalid={Boolean(errors.systemInstructions)}
          className={inputClassName}
        />
        {errors.systemInstructions && <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.systemInstructions}</p>}
      </div>

      {/* User Prompt / Instructions */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="ai-prompt" className="block text-xs font-medium text-[#c9b991]">
            User prompt / instructions<span className="ml-1 text-[#d98a74]">*</span>
          </label>
          <span className="text-[10px] text-[#756b5a]">Supports {'{{nodes.id.output.*}}'}</span>
        </div>
        <textarea
          ref={promptTextareaRef}
          id="ai-prompt"
          value={value.prompt ?? ''}
          onChange={(event) => setField('prompt', event.target.value)}
          rows={4}
          placeholder="e.g. Summarize the following data and extract action items: {{nodes.httpRequest1.output.data}}"
          aria-invalid={Boolean(errors.prompt)}
          className={inputClassName}
        />
        {errors.prompt && <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.prompt}</p>}
      </div>

      {/* Inference Parameters */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="ai-temperature" className="block text-xs font-medium text-[#c9b991]">
              Temperature: {value.temperature ?? 0.7}
            </label>
          </div>
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
          <p className="mt-1 text-[10px] text-[#756b5a]">0 = Deterministic, 2 = Creative</p>
          {errors.temperature && <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.temperature}</p>}
        </div>

        <div>
          <label htmlFor="ai-max-tokens" className="block text-xs font-medium text-[#c9b991]">
            Max Output Tokens
          </label>
          <input
            id="ai-max-tokens"
            type="number"
            min="1"
            max="128000"
            step="100"
            value={value.maxOutputTokens ?? 1000}
            onChange={(event) => setField('maxOutputTokens', Number(event.target.value))}
            aria-invalid={Boolean(errors.maxOutputTokens)}
            className={inputClassName}
          />
          <p className="mt-1 text-[10px] text-[#756b5a]">Maximum tokens generated</p>
          {errors.maxOutputTokens && <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.maxOutputTokens}</p>}
        </div>
      </div>

      {/* Structured JSON Output Mode */}
      <div className="rounded-lg border border-[#8e7139]/30 bg-[#14100c] p-3.5 space-y-3">
        <label className="flex cursor-pointer items-center justify-between text-xs font-medium text-[#f0e5c9]">
          <div className="flex items-center gap-2">
            <FileJson className="h-4 w-4 text-[#d4ad58]" />
            <span>Require structured JSON output</span>
          </div>
          <input
            type="checkbox"
            checked={Boolean(value.structuredOutput)}
            onChange={(event) => setField('structuredOutput', event.target.checked)}
            className="h-4 w-4 accent-[#c69b45]"
          />
        </label>

        {value.structuredOutput && (
          <div className="space-y-2.5 pt-2 border-t border-[#8e7139]/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#9d9076]">Output JSON Schema</span>
              {schemaValidation && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${schemaValidation.valid
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                    : 'bg-rose-950 text-rose-300 border border-rose-800/40'
                    }`}
                >
                  {schemaValidation.message}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] text-[#756b5a] self-center mr-1">Templates:</span>
              {SCHEMA_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.label}
                  type="button"
                  onClick={() => setField('outputSchema', tmpl.schema)}
                  className="rounded bg-[#1f1912] border border-[#8e7139]/30 px-2 py-0.5 text-[10px] text-[#c9b991] hover:border-[#c69b45] hover:text-[#f0e5c9] transition"
                >
                  {tmpl.label}
                </button>
              ))}
            </div>

            <textarea
              id="ai-output-schema"
              value={value.outputSchema ?? ''}
              onChange={(event) => setField('outputSchema', event.target.value)}
              rows={5}
              placeholder='{"type":"object","properties":{"summary":{"type":"string"}}}'
              aria-invalid={Boolean(errors.outputSchema)}
              className={`${inputClassName} font-mono text-xs`}
            />
            {errors.outputSchema && <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.outputSchema}</p>}
          </div>
        )}
      </div>

      {/* Conversation Memory */}
      <div className="rounded-lg border border-[#8e7139]/30 bg-[#14100c] p-3.5">
        <label className="flex cursor-pointer items-center justify-between text-xs font-medium text-[#f0e5c9]">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-[#d4ad58]" />
            <div>
              <p>Conversation history / memory</p>
              <p className="text-[10px] text-[#8f8065] font-normal">Retain prior context within this workflow execution</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={Boolean(value.enableMemory)}
            onChange={(event) => setField('enableMemory', event.target.checked)}
            className="h-4 w-4 accent-[#c69b45]"
          />
        </label>
      </div>

      {/* Controlled Tool Selection */}
      <div className="rounded-lg border border-[#8e7139]/30 bg-[#14100c] p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#d4ad58]">
            <Wrench className="h-3.5 w-3.5" />
            Agent Tools
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#88795e]">
              {currentTools.length} of {IMPLEMENTED_TOOLS.length} active
            </span>
            {currentTools.length > 0 && (
              <button
                type="button"
                onClick={() => setField('tools', [])}
                className="text-[10px] text-[#d98a74] hover:underline"
              >
                Disable all
              </button>
            )}
          </div>
        </div>

        <p className="text-[11px] text-[#9d9076]">
          Controlled tools the agent can invoke during execution. If disabled, runs as a pure LLM.
        </p>

        <div className="space-y-2">
          {IMPLEMENTED_TOOLS.map((tool) => {
            const isEnabled = currentTools.includes(tool.id)
            const ToolIcon = tool.icon

            return (
              <label
                key={tool.id}
                className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 transition ${isEnabled
                  ? 'border-[#d4ad58]/50 bg-[#1d1610]'
                  : 'border-[#8e7139]/20 bg-[#100d0a]/60 opacity-70 hover:opacity-100'
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
    </div>
  )
}

export default AIAgentConfigForm
