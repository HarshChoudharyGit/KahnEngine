import { useState } from 'react'
import { m as motion } from 'framer-motion'
import {
  workflowPreviewNodes as nodes,
  workflowPreviewPaths as paths,
  workflowPreviewPoints as points,
} from '../../data/landingData.js'

function WorkflowPreview({ replayKey, reducedMotion }) {
  const [hoveredNode, setHoveredNode] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const activeNode = hoveredNode ?? selectedNode
  const selectedDetails = nodes.find((node) => node.id === selectedNode)

  return (
    <div key={replayKey} className="workflow-demo overflow-x-auto pb-2">
      <div
        className="relative mx-auto h-[440px] w-full min-w-[760px] max-w-[1000px]"
        onMouseLeave={() => setHoveredNode(null)}
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 1000 440"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="workflow-line" x1="0" x2="1">
              <stop stopColor="#8e7139" stopOpacity=".32" />
              <stop offset=".5" stopColor="#d4ad58" stopOpacity=".92" />
              <stop offset="1" stopColor="#8e7139" stopOpacity=".45" />
            </linearGradient>
          </defs>
          {paths.map(({ from, to, d, delay, branch }) => {
            const connected = activeNode && (from === activeNode || to === activeNode)

            return (
              <motion.path
                key={`${replayKey}-${d}`}
                d={d}
                fill="none"
                stroke={connected ? '#f0d58e' : branch ? '#a9997b' : 'url(#workflow-line)'}
                strokeWidth={connected ? 2.5 : branch ? 1.5 : 2}
                strokeDasharray={branch ? '5 7' : undefined}
                strokeLinecap="round"
                initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1 }}
                animate={{ opacity: activeNode && !connected ? 0.24 : 1 }}
                viewport={{ once: false, amount: 0.35 }}
                transition={{
                  pathLength: { duration: reducedMotion ? 0 : 0.7, ease: 'easeInOut', delay: reducedMotion ? 0 : delay },
                  opacity: { duration: reducedMotion ? 0 : 0.2 },
                }}
              />
            )
          })}
          {points.map(([x, y]) => {
            const pointNode = nodes.find((node) => node.x === x && node.y === y)
            const isActive = pointNode && activeNode === pointNode.id

            return (
              <motion.circle
                key={`workflow-dot-${x}-${y}`}
                cx={x}
                cy={y}
                r={isActive ? 6 : 4}
                fill={isActive ? '#f0d58e' : '#bca36f'}
                transition={{ duration: 0.18 }}
              />
            )
          })}
        </svg>

        <motion.p
          className="absolute left-[25%] top-[71%] -translate-x-1/2 font-mono text-[9px] uppercase tracking-[.18em] text-[#88795e]"
          initial={reducedMotion ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: reducedMotion ? 0 : 0.4, delay: 1.7 }}
        >
          AI tools & connected services
        </motion.p>

        {nodes.map(({ id, icon: Icon, title, detail, description, x, y, color, wide, tool }, index) => {
          const isActive = activeNode === id

          return (
            <motion.button
              key={`${replayKey}-${id}`}
              type="button"
              aria-pressed={selectedNode === id}
              aria-label={`${title}, ${detail}`}
              onClick={() => setSelectedNode((current) => current === id ? null : id)}
              onHoverStart={() => setHoveredNode(id)}
              onHoverEnd={() => setHoveredNode(null)}
              className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d4ad58]"
              style={{ left: `${x / 10}%`, top: `${y / 4.4}%` }}
              initial={reducedMotion ? false : { opacity: 0, scale: 0.78, y: 12 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              whileHover={reducedMotion ? undefined : { scale: 1.06, y: -3 }}
              whileTap={reducedMotion ? undefined : { scale: 0.97 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{
                opacity: { duration: reducedMotion ? 0 : 0.55, delay: reducedMotion ? 0 : 0.2 + index * 0.19 },
                scale: { type: 'spring', stiffness: 250, damping: 18 },
                y: { type: 'spring', stiffness: 250, damping: 18 },
              }}
            >
              <span
                className={`relative flex items-center gap-3 rounded-xl border bg-[#17120e]/95 shadow-[0_12px_30px_rgba(0,0,0,.28)] transition-colors duration-200 ${tool ? 'h-[64px] w-[64px] justify-center rounded-full' : `h-[68px] ${wide ? 'w-[158px]' : 'w-[126px]'} px-3`}`}
                style={{
                  borderColor: isActive ? color : 'rgba(142,113,57,.35)',
                  boxShadow: isActive ? `0 0 26px ${color}30, 0 12px 30px rgba(0,0,0,.28)` : undefined,
                }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-[#100d0a]"
                  style={{ borderColor: `${color}55`, color }}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                {!tool && (
                  <span className="min-w-0">
                    <span className="block text-[11px] font-medium leading-tight text-[#f0e5c9]">{title}</span>
                    <span className="mt-1 block font-mono text-[8px] uppercase tracking-[.1em] text-[#88795e]">{detail}</span>
                  </span>
                )}
                {tool && (
                  <span className="absolute -bottom-5 left-1/2 w-28 -translate-x-1/2 text-center text-[10px] font-medium text-[#c9b991]">
                    {title}
                  </span>
                )}
              </span>
              {!tool && <span className="mt-2 font-mono text-[9px] uppercase tracking-[.12em] text-[#88795e]">{detail}</span>}
              <span className="sr-only">{description}</span>
            </motion.button>
          )
        })}
      </div>

      <p aria-live="polite" className="mt-4 min-h-5 text-xs text-[#88795e]">
        {selectedDetails
          ? <><span className="font-medium text-[#d4ad58]">{selectedDetails.title}:</span> {selectedDetails.description}</>
          : <><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[#d4ad58]" />Select a step to explore this illustrative workflow.</>}
      </p>
      <p className="mt-2 text-[11px] text-[#766b59]">
        This is an illustrative preview, not a live workflow execution.
      </p>
    </div>
  )
}

export default WorkflowPreview
