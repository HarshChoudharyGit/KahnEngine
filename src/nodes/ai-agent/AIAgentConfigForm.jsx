const inputClassName = 'mt-1.5 w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-3 py-2.5 text-sm text-[#f0e5c9] outline-none transition placeholder:text-[#756b5a] focus:border-[#c69b45]'

function AIAgentConfigForm({ value, errors, onChange }) {
  const setField = (key, nextValue) => onChange({ ...value, [key]: nextValue })

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="ai-model" className="block text-xs font-medium text-[#c9b991]">Model</label>
        <select
          id="ai-model"
          value={value.model}
          onChange={(event) => setField('model', event.target.value)}
          className={inputClassName}
        >
          <option value="gpt-4o-mini">GPT-4o mini</option>
          <option value="gpt-4o">GPT-4o</option>
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
          rows={4}
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
          rows={4}
          placeholder="Summarize this lead: {{trigger.body}}"
          aria-invalid={Boolean(errors.prompt)}
          className={inputClassName}
        />
        {errors.prompt && <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.prompt}</p>}
      </div>

      <div>
        <label htmlFor="ai-temperature" className="block text-xs font-medium text-[#c9b991]">Temperature</label>
        <input
          id="ai-temperature"
          type="number"
          min="0"
          max="2"
          step="0.1"
          value={value.temperature}
          onChange={(event) => setField('temperature', Number(event.target.value))}
          aria-invalid={Boolean(errors.temperature)}
          className={inputClassName}
        />
        <p className="mt-1.5 text-[11px] text-[#8f8065]">Controls response variability (0–2).</p>
        {errors.temperature && <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.temperature}</p>}
      </div>

      <div>
        <label htmlFor="ai-max-tokens" className="block text-xs font-medium text-[#c9b991]">Maximum output tokens</label>
        <input
          id="ai-max-tokens"
          type="number"
          min="1"
          max="128000"
          step="1"
          value={value.maxOutputTokens}
          onChange={(event) => setField('maxOutputTokens', Number(event.target.value))}
          aria-invalid={Boolean(errors.maxOutputTokens)}
          className={inputClassName}
        />
        {errors.maxOutputTokens && <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.maxOutputTokens}</p>}
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
