const aiAgentConfig = {
  label: 'AI Agent (LangGraph)',
  description: 'Autonomous reasoning agent with LangChain & LangGraph Tool Calling capabilities.',
  defaults: {
    model: 'gpt-4o-mini',
    systemInstructions: 'You are an autonomous AI Agent in the Kahn Engine distributed pipeline. You have access to tools to accomplish user objectives accurately.',
    prompt: '',
    temperature: 0.7,
    maxOutputTokens: 1000,
    tools: ['web_search', 'code_interpreter', 'http_request'],
    structuredOutput: false,
    outputSchema: '',
  },
  fields: [
    {
      key: 'model',
      label: 'Model',
      type: 'select',
      options: [
        { value: 'gpt-4o-mini', label: 'GPT-4o mini (OpenAI)' },
        { value: 'gpt-4o', label: 'GPT-4o (OpenAI)' },
        { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
      ],
    },
    {
      key: 'systemInstructions',
      label: 'System instructions',
      type: 'textarea',
      placeholder: 'Define the agent role, behavior, and constraints...',
      rows: 3,
      required: true,
    },
    {
      key: 'prompt',
      label: 'User prompt / input template',
      type: 'textarea',
      placeholder: 'Synthesize upstream lead: {{trigger.body}} and verify with web search...',
      rows: 3,
      required: true,
    },
    {
      key: 'temperature',
      label: 'Temperature',
      type: 'number',
      min: 0,
      max: 2,
      step: 0.1,
      description: 'Controls response variability (0–2).',
    },
    {
      key: 'maxOutputTokens',
      label: 'Maximum output tokens',
      type: 'number',
      min: 1,
      max: 128000,
      step: 1,
    },
    {
      key: 'structuredOutput',
      label: 'Require structured JSON output',
      type: 'checkbox',
    },
    {
      key: 'outputSchema',
      label: 'JSON schema',
      type: 'textarea',
      placeholder: '{"type":"object","properties":{}}',
      rows: 4,
      when: ({ form }) => form.structuredOutput,
      required: true,
    },
  ],
  // Validates agent instructions, prompt templates, temperature, and JSON schema
  validate: (form) => {
    const errors = {}
    if (!form.systemInstructions?.trim()) errors.systemInstructions = 'Add system instructions.'
    if (!form.prompt?.trim()) errors.prompt = 'Add a prompt or input template.'
    if (!Number.isFinite(form.temperature) || form.temperature < 0 || form.temperature > 2) {
      errors.temperature = 'Temperature must be between 0 and 2.'
    }
    if (!Number.isInteger(form.maxOutputTokens) || form.maxOutputTokens < 1 || form.maxOutputTokens > 128000) {
      errors.maxOutputTokens = 'Enter a whole number from 1 to 128,000.'
    }
    if (form.structuredOutput && !form.outputSchema?.trim()) {
      errors.outputSchema = 'Add a JSON schema.'
    } else if (form.structuredOutput) {
      try {
        JSON.parse(form.outputSchema)
      } catch {
        errors.outputSchema = 'Enter valid JSON.'
      }
    }
    return errors
  },
}

export default aiAgentConfig
