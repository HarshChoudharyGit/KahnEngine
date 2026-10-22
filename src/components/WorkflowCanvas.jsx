import { useEffect, useRef, useState } from 'react'
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
  AlertCircle,
  Check,
  LoaderCircle,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import '@xyflow/react/dist/style.css'

import { initialNodes, initialEdges, nodeOptions } from '../data/editorData.js'
import {
  DEMO_EXECUTION_STEP_DELAY_MS,
  addExecutionToHistory,
  completeDemoExecution,
  createDemoExecution,
  loadExecutionHistory,
  recordDemoExecutionStep,
  saveExecutionHistory,
} from '../data/executionData.js'
import { createWorkflowFromTemplate } from '../data/workflowTemplates.js'
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
    error: 'Needs attention',
  }[status]
  const configurationStatus = data.configurationStatus ?? 'unconfigured'
  const configurationLabel = {
    configured: 'Configured',
    error: 'Needs attention',
    unconfigured: 'Not configured',
  }[configurationStatus]

  return (
    <div className={`workflow-node${selected ? ' is-selected' : ''}${status === 'running' ? ' is-running' : ''}`}>
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
          {status === 'success'
            ? <Check aria-hidden="true" className="h-3 w-3" />
            : status === 'running'
              ? <LoaderCircle aria-hidden="true" className="h-3 w-3 animate-spin" />
              : configurationStatus === 'error'
                ? <AlertCircle aria-hidden="true" className="h-3 w-3" />
                : null}
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

const nodeTypes = { workflow: WorkflowNode }

function WorkflowEditor({ activeTab, selectedTemplate }) {
  const [templateWorkflow] = useState(() =>
    selectedTemplate ? createWorkflowFromTemplate(selectedTemplate.id) : null,
  )
  const [nodes, setNodes, onNodesChange] = useNodesState(templateWorkflow?.nodes ?? initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(templateWorkflow?.edges ?? initialEdges)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [executionStatus, setExecutionStatus] = useState('idle')
  const [executionStep, setExecutionStep] = useState(0)
  const [initialHistory] = useState(() => {
    try {
      return { executions: loadExecutionHistory(), error: '' }
    } catch (error) {
      console.error('Unable to load workflow execution history.', error)
      return {
        executions: [],
        error: 'Saved execution history could not be loaded in this browser.',
      }
    }
  })
  const [executions, setExecutions] = useState(initialHistory.executions)
  const [selectedExecutionId, setSelectedExecutionId] = useState(initialHistory.executions[0]?.id ?? null)
  const [storageError, setStorageError] = useState(initialHistory.error)
  const nextNodeId = useRef(templateWorkflow ? templateWorkflow.nodes.length + 1 : 8)
  const activeExecutionRef = useRef(null)
  const persistHistoryRef = useRef(false)
  const { screenToFlowPosition, fitView } = useReactFlow()
  const selectedNode = nodes.find((node) => node.id === selectedNodeId)

  useEffect(() => {
    if (!persistHistoryRef.current) return

    let active = true
    Promise.resolve()
      .then(() => saveExecutionHistory(executions))
      .then(() => {
        if (active) setStorageError('')
      })
      .catch((error) => {
        console.error('Unable to save workflow execution history.', error)
        if (active) {
          setStorageError('Execution history could not be saved. It will be lost when you close this page.')
        }
      })

    return () => {
      active = false
    }
  }, [executions])

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
  }

  useEffect(() => {
    if (executionStatus !== 'running') return undefined
    const activeExecution = activeExecutionRef.current
    if (!activeExecution) return undefined

    if (executionStep >= activeExecution.nodes.length) {
      const timer = window.setTimeout(() => {
        setExecutionStatus('complete')
        setExecutions((currentExecutions) => completeDemoExecution(
          currentExecutions,
          activeExecution.id,
          activeExecution.startedAtMs,
        ))
      }, 0)
      return () => window.clearTimeout(timer)
    }

    const timer = window.setTimeout(() => {
      const completedNode = activeExecution.nodes[executionStep]
      setNodes((currentNodes) => currentNodes.map((node) => {
        const snapshotIndex = activeExecution.nodes.findIndex(({ id }) => id === node.id)
        return {
          ...node,
          data: {
            ...node.data,
            status: snapshotIndex === -1
              ? 'idle'
              : snapshotIndex <= executionStep
                ? 'success'
                : snapshotIndex === executionStep + 1
                  ? 'running'
                  : 'idle',
          },
        }
      }))
      setExecutions((currentExecutions) =>
        recordDemoExecutionStep(currentExecutions, activeExecution.id, completedNode),
      )
      setExecutionStep((step) => step + 1)
    }, DEMO_EXECUTION_STEP_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [executionStatus, executionStep, setNodes])

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

  const handleConnect = (connection) => {
    setEdges((currentEdges) =>
      addEdge({
        ...connection,
        type: 'smoothstep',
        animated: true,
        style: edgeStyle,
      }, currentEdges),
    )
  }

  const handleRun = () => {
    if (executionStatus === 'running' || nodes.length === 0) return

    persistHistoryRef.current = true
    const demoExecution = createDemoExecution(nodes)
    activeExecutionRef.current = {
      id: demoExecution.record.id,
      nodes: demoExecution.snapshot,
      startedAtMs: demoExecution.startedAtMs,
    }
    setExecutions((currentExecutions) =>
      addExecutionToHistory(currentExecutions, demoExecution.record),
    )
    setSelectedExecutionId(demoExecution.record.id)
    setNodes((currentNodes) => currentNodes.map((node) => ({
      ...node,
      data: { ...node.data, status: 'idle' },
    })))
    setExecutionStep(0)
    setExecutionStatus('running')
  }

  const clearWorkflow = () => {
    if (executionStatus === 'running') return
    setNodes([])
    setEdges([])
    setSelectedNodeId(null)
    setExecutionStatus('idle')
  }

  const clearHistory = () => {
    if (executionStatus === 'running') return
    persistHistoryRef.current = true
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
  }

  const markNodeConfigurationError = (nodeId) => {
    setNodes((currentNodes) => currentNodes.map((node) => (
      node.id === nodeId
        ? { ...node, data: { ...node.data, configurationStatus: 'error' } }
        : node
    )))
  }

  const deleteNode = (nodeId) => {
    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId))
    setEdges((currentEdges) => currentEdges.filter(
      (edge) => edge.source !== nodeId && edge.target !== nodeId,
    ))
    setSelectedNodeId(null)
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

      <div className="absolute left-1/2 top-5 z-10 flex -translate-x-1/2 items-center gap-2">
        <button
          type="button"
          onClick={() => fitView({ padding: 0.2, duration: 350 })}
          className="rounded-md border border-[#8e7139]/35 bg-[#17120e]/95 px-3 py-2 text-xs text-[#c9b991] shadow-lg transition hover:border-[#d4ad58]/65 hover:text-[#f0d58e]"
        >
          Fit workflow
        </button>
        {executionStatus === 'complete' && (
          <span className="rounded-md border border-emerald-800/60 bg-[#142018]/95 px-3 py-2 text-xs text-emerald-300">
            Run complete
          </span>
        )}
      </div>

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

      <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-[#8e7139]/30 bg-[#17120e]/95 p-2 shadow-xl">
        <button
          type="button"
          onClick={handleRun}
          disabled={executionStatus === 'running' || nodes.length === 0}
          className="rounded-md bg-[#c69b45] px-4 py-2 text-sm font-semibold text-[#21170c] transition hover:bg-[#dfb95f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {executionStatus === 'running' ? 'Running workflow…' : 'Test workflow'}
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
          storageError={storageError}
        />
      )}
    </main>
  )
}

function WorkflowCanvas({ activeTab, selectedTemplate }) {
  return (
    <ReactFlowProvider key={selectedTemplate?.revision ?? 'initial'}>
      <WorkflowEditor activeTab={activeTab} selectedTemplate={selectedTemplate} />
    </ReactFlowProvider>
  )
}

export default WorkflowCanvas
