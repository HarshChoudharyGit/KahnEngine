import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  NodeResizer,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  Plus,
  Radio,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import '@xyflow/react/dist/style.css'

import { initialNodes, initialEdges, nodeOptions } from '../data/editorData.js'
import { createWorkflowFromTemplate } from '../data/workflowTemplates.js'
import {
  connectTelemetryStream,
  clearExecutionsApi,
  executeWorkflow,
  listExecutions,
  saveWorkflow,
} from '../services/api.js'
import { runKahnsAlgorithm } from '../utils/kahnsAlgorithm.js'
import { validateNodeConfigurations } from '../utils/nodeConfigurationValidation.js'
import ExecutionHistory from './ExecutionHistory.jsx'
import NodePicker from './NodePicker.jsx'
import NodeConfigSidebar from './NodeConfigSidebar.jsx'

const edgeStyle = { stroke: '#a68b5a', strokeWidth: 1.8 }
const NODE_DRAG_DATA_TYPE = 'application/dormammu-node'

function WorkflowNode({ id, data, selected }) {
  const NodeIcon = data.icon ?? Sparkles
  const status = data.status ?? 'idle'
  const statusText = {
    idle: 'Idle',
    running: 'Working…',
    success: 'Complete',
    error: 'Failed',
  }[status] || 'Idle'
  const configurationStatus = data.configurationStatus ?? 'unconfigured'
  const configurationLabel = {
    configured: 'Configured',
    error: 'Needs attention',
    unconfigured: 'Not configured',
  }[configurationStatus]

  return (
    <div className={`workflow-node${selected ? ' is-selected' : ''}${status === 'running' ? ' is-running shadow-[0_0_15px_rgba(212,173,88,0.35)] ring-1 ring-[#d4ad58]' : status === 'success' ? ' ring-1 ring-emerald-500/40' : status === 'error' ? ' ring-1 ring-rose-500/40' : ''}`}>
      <NodeResizer
        isVisible={selected}
        minWidth={180}
        minHeight={84}
        maxWidth={520}
        maxHeight={320}
        color="#d4ad58"
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
      />
      <Handle type="target" position={Position.Left} className="workflow-handle" />
      {data.category === 'TRIGGER' && (
        <span className="workflow-node__badge flex items-center gap-1.5" style={{ backgroundColor: data.accent }}>
          <Sparkles aria-hidden="true" className="h-3 w-3" /> {data.category}
        </span>
      )}
      <div className="workflow-node__main">
        <span className="workflow-node__icon" style={{ color: data.accent, borderColor: `${data.accent}55` }}>
          <NodeIcon aria-hidden="true" className="h-4 w-4" />
        </span>
        <div className="workflow-node__copy">
          <span className="workflow-node__title">{data.title}</span>
          <span className="workflow-node__subtitle">{data.subtitle}</span>
        </div>
        <span className={`workflow-node__status workflow-node__status--${status}`} aria-label={`Node status: ${statusText}`}>
          {status === 'success' ? (
            <Check aria-hidden="true" className="h-3 w-3 text-emerald-400" />
          ) : status === 'running' ? (
            <LoaderCircle aria-hidden="true" className="h-3 w-3 animate-spin text-[#d4ad58]" />
          ) : status === 'error' ? (
            <AlertCircle aria-hidden="true" className="h-3 w-3 text-rose-400" />
          ) : configurationStatus === 'error' ? (
            <AlertCircle aria-hidden="true" className="h-3 w-3 text-amber-400" />
          ) : null}
        </span>
      </div>
      <div className="workflow-node__footer">
        <span>{data.category ?? 'ACTION'}</span>
        <span className={`workflow-node__config-status workflow-node__config-status--${configurationStatus}`}>
          {configurationLabel}
        </span>
      </div>
      {data.isCondition ? (
        <>
          <Handle id="true" type="source" position={Position.Right} style={{ top: '38%' }} className="workflow-handle" />
          <Handle id="false" type="source" position={Position.Right} style={{ top: '68%' }} className="workflow-handle workflow-handle--muted" />
        </>
      ) : (
        <Handle type="source" position={Position.Right} className="workflow-handle" />
      )}
      <span className="sr-only">Workflow node {id}</span>
    </div>
  )
}

function hydrateWorkflowNodes(nodes) {
  if (!Array.isArray(nodes) || nodes.length === 0) return initialNodes
  return nodes.map((node) => {
    const option = nodeOptions.find(
      (opt) => opt.configType === node.data?.configType || opt.title === node.data?.title,
    )
    return {
      ...node,
      type: node.type || 'workflow',
      data: {
        ...node.data,
        icon: option?.icon || Sparkles,
        accent: node.data?.accent || option?.accent || '#d4ad58',
        status: 'idle',
        configurationStatus: node.data?.configurationStatus || 'unconfigured',
      },
    }
  })
}

function hydrateWorkflowEdges(edges) {
  if (!Array.isArray(edges)) return initialEdges
  return edges.map((edge) => ({
    ...edge,
    type: edge.type || 'smoothstep',
    animated: edge.animated !== undefined ? edge.animated : true,
    style: edge.style || edgeStyle,
  }))
}

const nodeTypes = { workflow: WorkflowNode }

function WorkflowEditor({
  activeTab,
  selectedTemplate,
  loadedWorkflow,
  workflowTitle = 'My workflow',
  setSaveStatus,
  setIsSaving,
  saveActionRef,
}) {
  const [templateWorkflow] = useState(() =>
    selectedTemplate ? createWorkflowFromTemplate(selectedTemplate.id) : null,
  )

  const initialCanvasNodes = templateWorkflow
    ? templateWorkflow.nodes
    : loadedWorkflow
    ? hydrateWorkflowNodes(loadedWorkflow.nodes)
    : initialNodes

  const initialCanvasEdges = templateWorkflow
    ? templateWorkflow.edges
    : loadedWorkflow
    ? hydrateWorkflowEdges(loadedWorkflow.edges)
    : initialEdges

  const [nodes, setNodes, onNodesChange] = useNodesState(initialCanvasNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialCanvasEdges)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [executionStatus, setExecutionStatus] = useState('idle') // 'idle' | 'running' | 'complete' | 'failed'
  const [cycleWarning, setCycleWarning] = useState('')
  const [executions, setExecutions] = useState([])
  const [selectedExecutionId, setSelectedExecutionId] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTelemetryStats, setActiveTelemetryStats] = useState(null)

  const workflowIdRef = useRef(
    loadedWorkflow?.id || (templateWorkflow ? `wf_${templateWorkflow.id}` : `wf_${Date.now()}`),
  )
  const nextNodeId = useRef(initialCanvasNodes.length + 10)
  const activeStreamCloseRef = useRef(null)
  const { screenToFlowPosition, fitView } = useReactFlow()
  const selectedNode = nodes.find((node) => node.id === selectedNodeId)

  // Save workflow handler
  const handleSave = useCallback(async () => {
    try {
      setIsSaving?.(true)
      const sanitizedNodes = nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: {
          title: n.data?.title,
          subtitle: n.data?.subtitle,
          category: n.data?.category,
          accent: n.data?.accent,
          configType: n.data?.configType,
          configuration: n.data?.configuration,
          configurationStatus: n.data?.configurationStatus,
        },
      }))

      const saved = await saveWorkflow({
        id: workflowIdRef.current,
        name: workflowTitle,
        nodes: sanitizedNodes,
        edges,
      })
      if (saved?.workflow?.id) {
        workflowIdRef.current = saved.workflow.id
      }
      setSaveStatus?.('saved')
    } catch (err) {
      console.error('Failed to save workflow:', err)
      setSaveStatus?.('error')
    } finally {
      setIsSaving?.(false)
    }
  }, [nodes, edges, workflowTitle, setIsSaving, setSaveStatus])

  // Attach save action ref for Header trigger
  useEffect(() => {
    if (saveActionRef) {
      saveActionRef.current = handleSave
    }
  }, [saveActionRef, handleSave])

  // Refresh server executions
  const refreshHistory = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const serverExecutions = await listExecutions()
      if (Array.isArray(serverExecutions)) {
        setExecutions(serverExecutions)
        if (serverExecutions.length > 0 && !selectedExecutionId) {
          setSelectedExecutionId(serverExecutions[0].id)
        }
      }
    } catch (err) {
      console.warn('Could not reach Fastify gateway for execution history:', err.message)
    } finally {
      setIsRefreshing(false)
    }
  }, [selectedExecutionId])

  // Initial load
  useEffect(() => {
    refreshHistory()
    return () => {
      if (activeStreamCloseRef.current) {
        activeStreamCloseRef.current()
      }
    }
  }, [refreshHistory])

  // Refresh when switching to executions tab
  useEffect(() => {
    if (activeTab === 'executions') {
      refreshHistory()
    }
  }, [activeTab, refreshHistory])

  const openContextMenu = (event, item, type) => {
    event.preventDefault()
    const bounds = event.currentTarget.closest('main').getBoundingClientRect()
    setContextMenu({
      id: item.id,
      type,
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    })
  }

  const deleteContextItem = () => {
    if (!contextMenu) return

    if (contextMenu.type === 'node') {
      setNodes((currentNodes) => currentNodes.filter((node) => node.id !== contextMenu.id))
      setEdges((currentEdges) => currentEdges.filter(
        (edge) => edge.source !== contextMenu.id && edge.target !== contextMenu.id,
      ))
      if (selectedNodeId === contextMenu.id) setSelectedNodeId(null)
    } else {
      setEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== contextMenu.id))
    }

    setContextMenu(null)
    setSaveStatus?.('unsaved')
  }

  const addNode = (option, position) => {
    const id = `node-${nextNodeId.current++}`
    setNodes((currentNodes) => [
      ...currentNodes,
      {
        id,
        type: 'workflow',
        position,
        data: { ...option, status: 'idle', configurationStatus: 'unconfigured' },
      },
    ])
    setSelectedNodeId(id)
    setSaveStatus?.('unsaved')
  }

  const handleDrop = (event) => {
    event.preventDefault()
    const title = event.dataTransfer.getData(NODE_DRAG_DATA_TYPE)
    const option = nodeOptions.find((item) => item.title === title)
    if (!option) return

    addNode(option, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
    setPickerOpen(false)
  }

  const handleNodeDragStart = (event, title) => {
    event.dataTransfer.setData(NODE_DRAG_DATA_TYPE, title)
    event.dataTransfer.effectAllowed = 'copy'
  }

  const handlePaletteClick = (option) => {
    addNode(option, screenToFlowPosition({
      x: window.innerWidth * 0.58,
      y: window.innerHeight * 0.52,
    }))
    setPickerOpen(false)
  }

  // Edge connection with client-side Kahn's Algorithm cycle prevention
  const handleConnect = (connection) => {
    // 1. Create candidate edge set
    const candidateEdge = {
      ...connection,
      id: `e-${connection.source}-${connection.target}`,
      type: 'smoothstep',
      animated: true,
      style: edgeStyle,
    }
    const candidateEdges = [...edges, candidateEdge]

    // 2. Run Kahn's Algorithm validation
    const kahnResult = runKahnsAlgorithm(nodes, candidateEdges)
    if (!kahnResult.isValid) {
      setCycleWarning(
        `Cycle rejected by Kahn's Algorithm! Adding connection "${connection.source}" → "${connection.target}" creates an infinite execution cycle (${kahnResult.cycleNodes?.join(' ⇄ ')}).`,
      )
      return
    }

    setCycleWarning('')
    setEdges((currentEdges) => addEdge(candidateEdge, currentEdges))
    setSaveStatus?.('unsaved')
  }

  // Real Run Dispatch with SSE Telemetry Streaming
  const handleRun = async () => {
    if (executionStatus === 'running' || nodes.length === 0) return
    setCycleWarning('')

    // Client-side Kahn's Algorithm DAG check
    const validation = runKahnsAlgorithm(nodes, edges)
    if (!validation.isValid) {
      setCycleWarning(`Cannot execute workflow: ${validation.error}`)
      return
    }

    const configurationErrors = validateNodeConfigurations(nodes)
    if (configurationErrors.length > 0) {
      setNodes((currentNodes) =>
        currentNodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            configurationStatus: configurationErrors.some((error) => error.nodeId === node.id)
              ? 'error'
              : node.data.configurationStatus,
          },
        })),
      )
      setCycleWarning(configurationErrors
        .map(({ nodeTitle, messages }) => `${nodeTitle}: ${messages.join(' ')}`)
        .join(' '))
      return
    }

    setExecutionStatus('running')

    // Reset node states in the canvas
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        data: { ...node.data, status: 'idle' },
      })),
    )

    try {
      const sanitizedNodes = nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: {
          title: n.data?.title,
          subtitle: n.data?.subtitle,
          category: n.data?.category,
          accent: n.data?.accent,
          configType: n.data?.configType,
          configuration: n.data?.configuration,
          configurationStatus: n.data?.configurationStatus,
        },
      }))

      // Dispatch the validated workflow to the Fastify gateway.
      const dispatchResult = await executeWorkflow(workflowIdRef.current, {
        name: workflowTitle,
        nodes: sanitizedNodes,
        edges,
        triggerPayload: { source: 'webster-visual-canvas', timestamp: Date.now() },
      })

      const { executionId } = dispatchResult

      const newExecutionRecord = {
        id: executionId,
        workflowId: workflowIdRef.current,
        status: 'running',
        startedAt: new Date().toISOString(),
        finishedAt: null,
        durationMs: null,
        nodeCount: nodes.length,
        steps: [],
        logs: [],
      }

      setExecutions((prev) => [newExecutionRecord, ...prev.filter((e) => e.id !== executionId)])
      setSelectedExecutionId(executionId)
      setActiveTelemetryStats({ executionId, status: 'RUNNING', activeNode: null })

      // Clean up any existing stream
      if (activeStreamCloseRef.current) {
        activeStreamCloseRef.current()
      }

      // Connect to SSE Telemetry stream
      const closeStream = connectTelemetryStream(executionId, {
        onStarted: ({ topologicalOrder }) => {
          setActiveTelemetryStats((prev) => ({
            ...prev,
            topologicalOrder,
          }))
        },
        onNodeStatus: ({ nodeId, status, durationMs, error }) => {
          // 1. Update visual node in canvas
          setNodes((currentNodes) =>
            currentNodes.map((n) =>
              n.id === nodeId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      status:
                        status === 'RUNNING'
                          ? 'running'
                          : status === 'SUCCESS'
                          ? 'success'
                          : status === 'FAILED'
                          ? 'error'
                          : 'idle',
                    },
                  }
                : n,
            ),
          )

          setActiveTelemetryStats((prev) => ({
            ...prev,
            activeNode: status === 'RUNNING' ? nodeId : null,
          }))

          // 2. Update step in execution record
          setExecutions((prev) =>
            prev.map((item) => {
              if (item.id !== executionId) return item
              const nodeDef = nodes.find((n) => n.id === nodeId)
              const existingIndex = item.steps.findIndex((s) => s.nodeId === nodeId)
              const updatedStep = {
                nodeId,
                title: nodeDef?.data?.title || nodeId,
                category: nodeDef?.data?.category || 'ACTION',
                status: status,
                completedAt: new Date().toISOString(),
                durationMs: durationMs || null,
                error,
              }

              const nextSteps = [...item.steps]
              if (existingIndex >= 0) {
                nextSteps[existingIndex] = updatedStep
              } else {
                nextSteps.push(updatedStep)
              }

              return { ...item, steps: nextSteps }
            }),
          )
        },
        onNodeLog: (logEntry) => {
          setExecutions((prev) =>
            prev.map((item) => {
              if (item.id !== executionId) return item
              return {
                ...item,
                logs: [...(item.logs || []), logEntry],
              }
            }),
          )
        },
        onCompleted: ({ durationMs }) => {
          setExecutionStatus('complete')
          setActiveTelemetryStats(null)
          setExecutions((prev) =>
            prev.map((item) =>
              item.id === executionId
                ? {
                    ...item,
                    status: 'complete',
                    finishedAt: new Date().toISOString(),
                    durationMs: durationMs ?? (item.durationMs || 0),
                  }
                : item,
            ),
          )
        },
        onFailed: ({ error, durationMs }) => {
          setExecutionStatus('failed')
          setActiveTelemetryStats(null)
          setExecutions((prev) =>
            prev.map((item) =>
              item.id === executionId
                ? {
                    ...item,
                    status: 'failed',
                    error,
                    finishedAt: new Date().toISOString(),
                    durationMs: durationMs ?? (item.durationMs || 0),
                  }
                : item,
            ),
          )
        },
        onError: () => {
          // SSE stream closed
        },
      })

      activeStreamCloseRef.current = closeStream
    } catch (err) {
      console.error('Execution dispatch failed:', err)
      setExecutionStatus('failed')
      setCycleWarning(`Fastify gateway execution failed: ${err.message}`)
    }
  }

  const clearWorkflow = () => {
    if (executionStatus === 'running') return
    setNodes([])
    setEdges([])
    setSelectedNodeId(null)
    setExecutionStatus('idle')
    setSaveStatus?.('unsaved')
  }

  const clearHistory = async () => {
    if (executionStatus === 'running') return
    try {
      await clearExecutionsApi()
    } catch (err) {
      console.warn('Could not clear history on server:', err)
    }
    setExecutions([])
    setSelectedExecutionId(null)
  }

  const saveNodeConfiguration = (nodeId, configuration) => {
    setNodes((currentNodes) => currentNodes.map((node) => (
      node.id === nodeId
        ? {
            ...node,
            data: {
              ...node.data,
              ...(!node.data.configType
                ? { title: configuration.title, subtitle: configuration.subtitle }
                : {}),
              configuration,
              configurationStatus: 'configured',
            },
          }
        : node
    )))
    setSelectedNodeId(null)
    setSaveStatus?.('unsaved')
  }

  const markNodeConfigurationError = (nodeId) => {
    setNodes((currentNodes) => currentNodes.map((node) => (
      node.id === nodeId
        ? { ...node, data: { ...node.data, configurationStatus: 'error' } }
        : node
    )))
    setSaveStatus?.('unsaved')
  }

  const deleteNode = (nodeId) => {
    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId))
    setEdges((currentEdges) => currentEdges.filter(
      (edge) => edge.source !== nodeId && edge.target !== nodeId,
    ))
    setSelectedNodeId(null)
    setSaveStatus?.('unsaved')
  }

  return (
    <main
      className="relative min-h-0 flex-1 overflow-hidden bg-[#100d0a]"
      onClick={() => setContextMenu(null)}
      onDrop={handleDrop}
      onDragOver={(event) => event.preventDefault()}
    >
      {activeTab === 'editor' ? (
        <>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodesDelete={(deletedNodes) => {
              if (deletedNodes.some((node) => node.id === selectedNodeId)) {
                setSelectedNodeId(null)
              }
              setSaveStatus?.('unsaved')
            }}
            onConnect={handleConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => {
              setSelectedNodeId(null)
              setContextMenu(null)
            }}
            onNodeContextMenu={(event, node) => openContextMenu(event, node, 'node')}
            onEdgeContextMenu={(event, edge) => openContextMenu(event, edge, 'edge')}
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: true,
              style: edgeStyle,
            }}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={1.8}
            deleteKeyCode={['Backspace', 'Delete']}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1.1}
              color="#8e7139"
            />
            <Controls position="bottom-left" showInteractive={false} className="m-5" />
            <MiniMap
              position="top-left"
              pannable
              zoomable
              style={{ width: 140, height: 96 }}
              maskColor="rgba(16, 13, 10, 0.72)"
              nodeColor={(node) => node.data?.accent ?? '#c69b45'}
              className="border border-[#8e7139]/40! bg-[#17120e]!"
            />
          </ReactFlow>

          {/* Cycle Detection Floating Toast */}
          {cycleWarning && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 z-30 max-w-xl rounded-lg border border-amber-600/60 bg-[#25170d]/95 p-3.5 shadow-2xl backdrop-blur-md flex items-start gap-3 text-xs text-[#f5d089]">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-[#f0e5c9]">Kahn&apos;s Algorithm Cycle Prevention</p>
                <p className="mt-0.5 leading-relaxed text-[#dec69e]">{cycleWarning}</p>
              </div>
              <button
                type="button"
                onClick={() => setCycleWarning('')}
                className="text-[#a9997b] hover:text-[#f0e5c9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Context Menu */}
          {contextMenu && (
            <div
              role="menu"
              aria-label={`${contextMenu.type === 'node' ? 'Node' : 'Connection'} actions`}
              className="absolute z-20 min-w-36 rounded-md border border-[#8e7139]/45 bg-[#17120e] p-1 shadow-xl"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={deleteContextItem}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-[#d98a74] transition hover:bg-[#8f4d3b]/15"
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                Delete {contextMenu.type}
              </button>
            </div>
          )}

          {/* Top Control Bar */}
          <div className="absolute left-1/2 top-5 z-10 flex -translate-x-1/2 items-center gap-2">
            <button
              type="button"
              onClick={() => fitView({ padding: 0.2, duration: 350 })}
              className="rounded-md border border-[#8e7139]/35 bg-[#17120e]/95 px-3 py-2 text-xs text-[#c9b991] shadow-lg transition hover:border-[#d4ad58]/65 hover:text-[#f0d58e]"
            >
              Fit workflow
            </button>

            {executionStatus === 'running' && (
              <span className="flex items-center gap-1.5 rounded-md border border-[#d4ad58]/50 bg-[#251e16]/95 px-3 py-2 text-xs font-medium text-[#f0d58e] shadow-lg">
                <Radio className="h-3.5 w-3.5 animate-pulse text-[#d4ad58]" />
                Live SSE Streaming Active
              </span>
            )}

            {executionStatus === 'complete' && (
              <span className="flex items-center gap-1.5 rounded-md border border-emerald-800/60 bg-[#142018]/95 px-3 py-2 text-xs font-medium text-emerald-300 shadow-lg">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Run Complete
              </span>
            )}

            {executionStatus === 'failed' && (
              <span className="flex items-center gap-1.5 rounded-md border border-rose-800/60 bg-[#241713]/95 px-3 py-2 text-xs font-medium text-rose-300 shadow-lg">
                <XCircle className="h-3.5 w-3.5" />
                Run Failed
              </span>
            )}
          </div>

          {/* Node Add Button */}
          <button
            type="button"
            aria-label="Add a node"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((open) => !open)}
            className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-md border border-[#8e7139]/50 bg-[#17120e]/95 text-xl text-[#d4ad58] shadow-lg transition hover:border-[#d4ad58] hover:bg-[#241b13]"
          >
            {pickerOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Plus aria-hidden="true" className="h-5 w-5" />}
          </button>

          {pickerOpen && (
            <NodePicker
              onSelect={handlePaletteClick}
              onDragStart={handleNodeDragStart}
              onClose={() => setPickerOpen(false)}
            />
          )}

          <NodeConfigSidebar
            node={selectedNode}
            onClose={() => setSelectedNodeId(null)}
            onDelete={deleteNode}
            onSave={saveNodeConfiguration}
            onInvalidSave={markNodeConfigurationError}
          />

          {/* Bottom Execution Action Floating Dock */}
          <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-[#8e7139]/30 bg-[#17120e]/95 p-2 shadow-2xl backdrop-blur-sm">
            <button
              id="test-workflow-btn"
              type="button"
              onClick={handleRun}
              disabled={executionStatus === 'running' || nodes.length === 0}
              className="flex items-center gap-2 rounded-md bg-[#c69b45] px-4 py-2 text-sm font-semibold text-[#21170c] transition hover:bg-[#dfb95f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {executionStatus === 'running' ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin text-[#21170c]" />
                  <span>Executing ({activeTelemetryStats?.activeNode || 'Pipeline'})…</span>
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4 text-[#21170c]" />
                  <span>Test workflow</span>
                </>
              )}
            </button>

            <button
              type="button"
              aria-label="Clear workflow"
              onClick={clearWorkflow}
              disabled={executionStatus === 'running'}
              className="flex h-9 w-9 items-center justify-center rounded-md text-[#a9997b] transition hover:bg-[#d4ad58]/10 hover:text-[#f0d58e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : (
        <ExecutionHistory
          executions={executions}
          selectedExecutionId={selectedExecutionId}
          onSelectExecution={setSelectedExecutionId}
          onClearHistory={clearHistory}
          onRefreshHistory={refreshHistory}
          isRefreshing={isRefreshing}
        />
      )}
    </main>
  )
}

function WorkflowCanvas({
  activeTab,
  selectedTemplate,
  loadedWorkflow,
  workflowTitle,
  setSaveStatus,
  setIsSaving,
  saveActionRef,
}) {
  const providerKey = `${selectedTemplate?.id || 'notpl'}_${selectedTemplate?.revision || 0}_${loadedWorkflow?.id || 'nowf'}`
  return (
    <ReactFlowProvider key={providerKey}>
      <WorkflowEditor
        activeTab={activeTab}
        selectedTemplate={selectedTemplate}
        loadedWorkflow={loadedWorkflow}
        workflowTitle={workflowTitle}
        setSaveStatus={setSaveStatus}
        setIsSaving={setIsSaving}
        saveActionRef={saveActionRef}
      />
    </ReactFlowProvider>
  )
}

export default WorkflowCanvas
