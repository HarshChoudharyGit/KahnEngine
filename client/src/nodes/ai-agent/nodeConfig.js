const aiAgentConfig = {
  label: 'AI Agent (Gemini)',
  description: 'Production-ready AI assistant powered exclusively by Google Gemini for summarization, reasoning, and data processing.',
  defaults: {
    title: 'AI Agent',
    provider: 'gemini',
    model: 'gemini-3.5-flash',
    systemInstructions: 'You are an autonomous AI Agent in the Kahn Engine distributed pipeline powered by Google Gemini. Follow instructions carefully and produce clean, accurate responses.',
    prompt: '',
    temperature: 0.7,
    maxOutputTokens: 1000,
    tools: [],
    structuredOutput: false,
    outputSchema: '',
    enableMemory: false,
  },
  fields: [
    {
      key: 'title',
      label: 'Node Name',
      type: 'text',
      placeholder: 'e.g. Lead Summarizer, Data Classifier',
      required: true,
    },
    {
      key: 'provider',
      label: 'Provider',
      type: 'select',
      options: [
        { value: 'gemini', label: 'Google Gemini' },
      ],
    },
    {
      key: 'model',
      label: 'Model',
      type: 'select',
      options: [
        { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (Fast & reliable - Recommended)' },
        { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite (Ultra-fast)' },
        { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (High Reasoning)' },
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
      placeholder: 'Synthesize data: {{nodes.httpRequest1.output.data}} and answer questions...',
      rows: 4,
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
      placeholder: '{"type":"object","properties":{"summary":{"type":"string"}}}',
      rows: 4,
      when: ({ form }) => form.structuredOutput,
      required: true,
    },
    {
      key: 'enableMemory',
      label: 'Enable conversation memory',
      type: 'checkbox',
      description: 'Retain prior conversation turns within workflow execution.',
    },
  ],
  validate: (form) => {
    const errors = {}
    if (!form.title?.trim() && !form.nodeName?.trim()) {
      errors.title = 'Add a node name.'
    }
    if (!form.systemInstructions?.trim()) {
      errors.systemInstructions = 'Add system instructions.'
    }
    if (!form.prompt?.trim()) {
      errors.prompt = 'Add a prompt or input template.'
    }
    const supportedModels = [
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gpt-4o-mini',
      'gpt-4o',
    ]
    if (form.model && !supportedModels.includes(form.model)) {
      errors.model = 'Choose a supported Gemini model.'
    }
    if (form.temperature !== undefined && (!Number.isFinite(Number(form.temperature)) || Number(form.temperature) < 0 || Number(form.temperature) > 2)) {
      errors.temperature = 'Temperature must be between 0 and 2.'
    }
    if (form.maxOutputTokens !== undefined && (!Number.isInteger(Number(form.maxOutputTokens)) || Number(form.maxOutputTokens) < 1 || Number(form.maxOutputTokens) > 128000)) {
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
