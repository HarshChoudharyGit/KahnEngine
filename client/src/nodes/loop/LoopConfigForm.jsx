const inputClassName = 'mt-1.5 w-full rounded-md border border-[#8e7139]/35 bg-[#100d0a] px-3 py-2.5 text-sm text-[#f0e5c9] outline-none transition focus:border-[#c69b45]'

function LoopConfigForm({ value, errors, onChange }) {
  const update = (key, nextValue) => onChange({ ...value, [key]: nextValue })

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="loop-mode" className="block text-xs font-medium text-[#c9b991]">Loop mode</label>
        <select
          id="loop-mode"
          value={value.mode || 'forEach'}
          onChange={(event) => update('mode', event.target.value)}
          className={inputClassName}
          aria-invalid={Boolean(errors.mode)}
        >
          <option value="forEach">For Each Item</option>
          <option value="fixed">Fixed Iterations</option>
        </select>
        {errors.mode && <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.mode}</p>}
      </div>

      {value.mode !== 'fixed' ? (
        <div>
          <label htmlFor="loop-array-expression" className="block text-xs font-medium text-[#c9b991]">Array expression</label>
          <input
            id="loop-array-expression"
            type="text"
            value={value.arrayExpression || ''}
            onChange={(event) => update('arrayExpression', event.target.value)}
            placeholder="{{nodes.httpRequest1.output.data}}"
            className={inputClassName}
            aria-invalid={Boolean(errors.arrayExpression)}
          />
          {errors.arrayExpression
            ? <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.arrayExpression}</p>
            : <p className="mt-1.5 text-[11px] leading-relaxed text-[#8f8065]">This expression must resolve to an array. Inside the body use {'{{loop.item}}'}, {'{{loop.index}}'} (zero-based), {'{{loop.iteration}}'} (one-based), and {'{{loop.total}}'}.</p>}
        </div>
      ) : (
        <div>
          <label htmlFor="loop-iterations" className="block text-xs font-medium text-[#c9b991]">Number of iterations</label>
          <input
            id="loop-iterations"
            type="number"
            min="1"
            max="1000"
            step="1"
            value={value.iterations ?? 1}
            onChange={(event) => update('iterations', event.target.value)}
            className={inputClassName}
            aria-invalid={Boolean(errors.iterations)}
          />
          {errors.iterations && <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.iterations}</p>}
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#8f8065]">Use {'{{loop.index}}'} (zero-based), {'{{loop.iteration}}'} (one-based), and {'{{loop.total}}'} in loop body nodes.</p>
        </div>
      )}

      <div>
        <label htmlFor="loop-max-iterations" className="block text-xs font-medium text-[#c9b991]">Maximum iterations</label>
        <input
          id="loop-max-iterations"
          type="number"
          min="1"
          max="1000"
          step="1"
          value={value.maxIterations ?? 100}
          onChange={(event) => update('maxIterations', event.target.value)}
          className={inputClassName}
          aria-invalid={Boolean(errors.maxIterations)}
        />
        {errors.maxIterations
          ? <p role="alert" className="mt-1.5 text-[11px] text-[#e18a7a]">{errors.maxIterations}</p>
          : <p className="mt-1.5 text-[11px] text-[#8f8065]">Safety cap: 1 to 1000 iterations. Default is 100.</p>}
      </div>
    </div>
  )
}

export default LoopConfigForm
