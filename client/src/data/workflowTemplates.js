import { initialEdges, nodeOptions } from './editorData.js'


//replace it with original templates from server/src/app.js
const templates = [
  {
    id: 'github-email',
    name: 'GitHub activity digest',
    description: 'Start with a repository event and prepare an email action.',
    nodes: ['GitHub Trigger', 'Gmail'],
    connections: [[0, 1]],
  },
  {
    id: 'webhook-discord',
    name: 'Webhook to Discord',
    description: 'Receive a webhook and send a message to Discord.',
    nodes: ['Webhook Trigger', 'Discord'],
    connections: [[0, 1]],
  },
  {
    id: 'scheduled-request',
    name: 'Scheduled HTTP request',
    description: 'Run an HTTP request on a recurring schedule.',
    nodes: ['Cron Trigger', 'HTTP Request'],
    connections: [[0, 1]],
  },
]

//actual function to create workflow from template

function createWorkflowFromTemplate(templateId) {
  const template = templates.find(({ id }) => id === templateId)
  if (!template) {
    throw new Error(`Unknown workflow template: ${templateId}`)
  }

  const nodes = template.nodes.map((title, index) => {
    const option = nodeOptions.find((nodeOption) => nodeOption.title === title)
    if (!option) {
      throw new Error(`Workflow template node "${title}" is not available.`)
    }

    return {
      id: `node-${index + 1}`,
      type: 'workflow',
      position: { x: 80 + index * 300, y: 100 },
      data: {
        ...option,
        status: 'idle',
        configurationStatus: 'unconfigured',
      },
    }
  })

  const edges = template.connections.map(([sourceIndex, targetIndex]) => {
    const source = nodes[sourceIndex]
    const target = nodes[targetIndex]
    if (!source || !target) {
      throw new Error(`Workflow template "${template.name}" has an invalid connection.`)
    }

    const baseEdge = initialEdges[0]
    return {
      ...baseEdge,
      id: `e-${source.id}-${target.id}`,
      source: source.id,
      target: target.id,
    }
  })

  return { nodes, edges }
}

export { createWorkflowFromTemplate, templates as workflowTemplates }
