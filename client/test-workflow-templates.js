import assert from 'node:assert/strict'
import test from 'node:test'
import { createWorkflowFromTemplate, workflowTemplates } from './src/data/workflowTemplates.js'
import { executeWorkflow } from '../server/src/engine/executor.js'
import { clearMockAIProvider, setMockAIProvider } from '../server/src/engine/agent/langgraphAgent.js'
import { runKahnsAlgorithm } from '../server/src/engine/kahnsAlgorithm.js'
import { validateNodeConfigurations } from '../server/src/engine/nodeConfigurationValidation.js'
import { memoryStore } from '../server/src/store/memoryStore.js'

const templateId = 'ai-internship-job-alert'

async function runWithMockPersistence(workflow, integrations = {}) {
  const state = { started: [], finished: [], logs: [], update: null }
  const persistence = {
    startExecution: async () => {},
    startNodeExecution: async (_id, record) => state.started.push(record),
    finishNodeExecution: async (_id, record) => state.finished.push(record),
    appendLog: async (_id, record) => state.logs.push(record),
    updateExecution: async (_id, record) => { state.update = record },
  }
  await executeWorkflow(workflow, `job-alert-test-${Date.now()}-${Math.random()}`, {}, {
    persistence,
    integrations,
  })
  return state
}

test('job alert template is registered with supported, unique nodes and valid edges', () => {
  const registered = workflowTemplates.find((template) => template.id === templateId)
  assert.ok(registered)
  assert.equal(registered.name, 'AI Internship & Job Alert Agent')

  const workflow = createWorkflowFromTemplate(templateId)
  const ids = workflow.nodes.map((node) => node.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(workflow.nodes.every((node) => node.data.configType))
  assert.ok(workflow.edges.every((edge) => ids.includes(edge.source) && ids.includes(edge.target)))
  assert.equal(runKahnsAlgorithm(workflow.nodes, workflow.edges).isValid, true)
  assert.deepEqual(validateNodeConfigurations(workflow.nodes), [])
  assert.deepEqual(
    workflow.edges.filter((edge) => edge.source === 'eachJob').map((edge) => edge.sourceHandle),
    ['loop-body', 'loop-next'],
  )
})

test('template defaults to an inactive daily cron and built-in mock HTTP response', () => {
  const workflow = createWorkflowFromTemplate(templateId)
  const cron = workflow.nodes.find((node) => node.id === 'dailyCron').data.configuration
  const request = workflow.nodes.find((node) => node.id === 'fetchJobs').data.configuration
  assert.equal(cron.cronExpression, '0 9 * * *')
  assert.equal(cron.timezone, 'Asia/Kolkata')
  assert.equal(cron.enabled, false)
  assert.equal(request.mockMode, true)
  assert.equal(request.url, 'https://api.example.com/jobs')
  assert.equal(JSON.parse(request.mockResponse).data.jobs.length, 3)
})

test('mock job-alert workflow filters, evaluates, aggregates and sends one post-loop digest', async () => {
  const workflow = createWorkflowFromTemplate(templateId)
  const executionId = `job-alert-template-${Date.now()}`
  const state = { started: [], finished: [], logs: [], update: null }
  const messages = []
  const events = []
  const persistence = {
    startExecution: async () => {},
    startNodeExecution: async (_id, record) => state.started.push(record),
    finishNodeExecution: async (_id, record) => state.finished.push(record),
    appendLog: async (_id, record) => state.logs.push(record),
    updateExecution: async (_id, record) => { state.update = record },
  }
  const subscriber = { raw: { write: (event) => events.push(event) } }
  setMockAIProvider(async ({ prompt }) => ({
    structured: {
      relevanceScore: prompt.includes('Software Engineering Intern') ? 91 : 68,
      reason: 'Matches the student software and AI preferences.',
      matchingSkills: ['Python'],
      missingSkills: ['Cloud deployment'],
      decision: prompt.includes('Software Engineering Intern') ? 'SHORTLIST' : 'SKIP',
    },
  }))
  memoryStore.addSubscriber(executionId, subscriber)
  try {
    await executeWorkflow(workflow, executionId, {}, {
      persistence,
      integrations: {
        isGmailConnected: () => true,
        getGmailUser: () => ({ email: 'mock@example.com' }),
        sendEmail: async (message) => {
          assert.equal(state.started.filter((entry) => entry.nodeId === 'eachJob').length, 1)
          assert.equal(state.started.filter((entry) => entry.nodeId === 'jobAggregate').length, 1)
          messages.push(message)
          return { messageId: 'mock-job-alert-message' }
        },
      },
    })
  } finally {
    memoryStore.removeSubscriber(executionId, subscriber)
    clearMockAIProvider()
  }

  const outputFor = (nodeId) => state.finished
    .filter((entry) => entry.nodeId === nodeId && entry.status === 'completed')
    .at(-1)?.output
  assert.equal(state.update.status, 'SUCCESS')
  assert.equal(outputFor('fetchJobs').totalJobs, 3)
  assert.equal(outputFor('eachJob').results.length, 3)
  assert.equal(outputFor('jobAggregate').shortlistedCount, 1)
  assert.equal(outputFor('jobAggregate').shortlisted[0].title, 'Software Engineering Intern')
  assert.equal(messages.length, 1)
  assert.match(messages[0].body, /Jobs fetched: 3/)
  assert.match(messages[0].body, /Jobs shortlisted: 1/)
  assert.match(messages[0].body, /https:\/\/example\.com\/jobs\/software-intern/)
  assert.ok(state.finished.some((entry) => entry.nodeId === 'aiReview' && entry.status === 'skipped'))
  assert.match(events.join(''), /"status":"iteration_completed"/)
  assert.match(events.join(''), /"status":"completed"/)
})

test('job alert template can skip email delivery when no matches are configured', async () => {
  const workflow = createWorkflowFromTemplate(templateId)
  const request = workflow.nodes.find((node) => node.id === 'fetchJobs')
  request.data.configuration.mockResponse = JSON.stringify({ data: { jobs: [] } })
  workflow.nodes.find((node) => node.id === 'sendDigest').data.configuration.sendNoMatches = false
  const state = { finished: [], update: null }
  let sent = false
  await executeWorkflow(workflow, `job-alert-empty-${Date.now()}`, {}, {
    persistence: {
      startExecution: async () => {},
      startNodeExecution: async () => {},
      finishNodeExecution: async (_id, record) => state.finished.push(record),
      appendLog: async () => {},
      updateExecution: async (_id, record) => { state.update = record },
    },
    integrations: {
      isGmailConnected: () => true,
      getGmailUser: () => ({ email: 'mock@example.com' }),
      sendEmail: async () => { sent = true },
    },
  })

  assert.equal(state.update.status, 'SUCCESS')
  assert.equal(sent, false)
  assert.equal(state.finished.find((entry) => entry.nodeId === 'eachJob' && entry.status === 'completed').output.total, 0)
})

test('invalid HTTP response paths fail the workflow before the loop', async () => {
  const workflow = createWorkflowFromTemplate(templateId)
  workflow.nodes.find((node) => node.id === 'fetchJobs').data.configuration.responsePath = 'data.missing'

  const state = await runWithMockPersistence(workflow)
  assert.equal(state.update.status, 'FAILED')
  assert.match(state.update.error, /did not resolve to an array/)
  assert.equal(state.started.some((entry) => entry.nodeId === 'eachJob'), false)
})

test('invalid AI evaluation output fails instead of being shortlisted', async () => {
  const workflow = createWorkflowFromTemplate(templateId)
  workflow.nodes.find((node) => node.id === 'fetchJobs').data.configuration.mockResponse = JSON.stringify({
    data: {
      jobs: [{
        title: 'Software Engineering Intern',
        company: 'Example',
        location: 'Remote',
        employment_type: 'internship',
        description: 'Python software work',
        application_url: 'https://example.com/apply',
      }],
    },
  })
  setMockAIProvider(async () => ({
    structured: {
      relevanceScore: 101,
      reason: 'Invalid score.',
      matchingSkills: [],
      missingSkills: [],
      decision: 'SHORTLIST',
    },
  }))
  try {
    const state = await runWithMockPersistence(workflow, {
      isGmailConnected: () => true,
      getGmailUser: () => ({ email: 'mock@example.com' }),
      sendEmail: async () => assert.fail('Invalid AI output must not send email.'),
    })
    assert.equal(state.update.status, 'FAILED')
    assert.match(state.update.error, /relevanceScore must be an integer from 0 to 100/)
    assert.equal(state.started.some((entry) => entry.nodeId === 'sendDigest'), false)
  } finally {
    clearMockAIProvider()
  }
})

test('Gmail delivery failures are surfaced and disconnected Gmail is explicitly simulated', async () => {
  const workflow = createWorkflowFromTemplate(templateId)
  const request = workflow.nodes.find((node) => node.id === 'fetchJobs')
  request.data.configuration.mockResponse = JSON.stringify({ data: { jobs: [] } })
  const disconnectedState = await runWithMockPersistence(workflow, {
    isGmailConnected: () => false,
    getGmailUser: () => null,
    sendEmail: async () => assert.fail('Disconnected Gmail must not attempt delivery.'),
  })
  const simulatedResult = disconnectedState.finished
    .find((entry) => entry.nodeId === 'sendDigest' && entry.status === 'completed')?.output
  assert.equal(disconnectedState.update.status, 'SUCCESS')
  assert.equal(simulatedResult.simulated, true)

  const deliverWorkflow = createWorkflowFromTemplate(templateId)
  deliverWorkflow.nodes.find((node) => node.id === 'fetchJobs').data.configuration.mockResponse = JSON.stringify({
    data: {
      jobs: [{
        title: 'Software Engineering Intern',
        company: 'Example',
        location: 'Remote',
        employment_type: 'internship',
        description: 'Python software work',
        application_url: 'https://example.com/apply',
      }],
    },
  })
  setMockAIProvider(async () => ({
    structured: {
      relevanceScore: 90,
      reason: 'Relevant.',
      matchingSkills: ['Python'],
      missingSkills: [],
      decision: 'SHORTLIST',
    },
  }))
  try {
    const failureState = await runWithMockPersistence(deliverWorkflow, {
      isGmailConnected: () => true,
      getGmailUser: () => ({ email: 'mock@example.com' }),
      sendEmail: async () => { throw new Error('Mock Gmail delivery failure.') },
    })
    assert.equal(failureState.update.status, 'FAILED')
    assert.match(failureState.update.error, /Mock Gmail delivery failure/)
  } finally {
    clearMockAIProvider()
  }
})

test('job-alert mappings accept Himalayas API job fields and aggregate application links', async () => {
  const workflow = createWorkflowFromTemplate(templateId)
  const request = workflow.nodes.find((node) => node.id === 'fetchJobs')
  request.data.configuration.url = 'https://himalayas.app/jobs/api/search?q=software%20engineer%20intern'
  request.data.configuration.responsePath = 'jobs'
  request.data.configuration.mockResponse = JSON.stringify({
    jobs: [{
      title: 'Software Engineering Intern',
      excerpt: 'Build software with Python and data structures.',
      companyName: 'Example Research',
      employmentType: 'Intern',
      locationRestrictions: [],
      applicationLink: 'https://example.com/intern-apply',
    }],
  })
  setMockAIProvider(async () => ({
    structured: {
      relevanceScore: 89,
      reason: 'Strong internship match.',
      matchingSkills: ['Python'],
      missingSkills: [],
      decision: 'SHORTLIST',
    },
  }))
  try {
    const state = await runWithMockPersistence(workflow, {
      isGmailConnected: () => true,
      getGmailUser: () => ({ email: 'mock@example.com' }),
      sendEmail: async () => ({ messageId: 'mock-himalayas-digest' }),
    })
    const digest = state.finished.find((entry) => entry.nodeId === 'jobAggregate' && entry.status === 'completed').output
    assert.equal(state.update.status, 'SUCCESS')
    assert.equal(digest.jobsFetched, 1)
    assert.equal(digest.shortlisted[0].company, 'Example Research')
    assert.equal(digest.shortlisted[0].location, 'Remote')
    assert.equal(digest.shortlisted[0].applicationUrl, 'https://example.com/intern-apply')
  } finally {
    clearMockAIProvider()
  }
})