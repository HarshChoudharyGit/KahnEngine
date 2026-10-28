import assert from 'node:assert/strict';
import test from 'node:test';
import { executeWorkflow, resolveExpressions, resolveVariablePath } from './src/engine/executor.js';
import { clearMockAIProvider, setMockAIProvider } from './src/engine/agent/langgraphAgent.js';
import { validateNodeConfigurations } from './src/engine/nodeConfigurationValidation.js';
import { memoryStore } from './src/store/memoryStore.js';

let executionNumber = 0;

function node(id, configType, configuration = {}) {
  return {
    id,
    type: 'workflow',
    data: { configType, title: id, configuration },
  };
}

function graph({ items, loopConfig = {}, bodyNodes, continuationNodes = [] }) {
  const nodes = [
    node('source', 'javascript', { code: 'return trigger.payload;' }),
    node('loop', 'loop', { mode: 'forEach', arrayExpression: '{{nodes.source.output.data}}', maxIterations: 100, ...loopConfig }),
    ...(bodyNodes || [node('body', 'javascript', {
      code: 'return { item: context.loop.item, index: context.loop.index, iteration: context.loop.iteration, total: context.loop.total };',
    })]),
    ...continuationNodes,
  ];
  const edges = [
    { source: 'source', target: 'loop' },
    { source: 'loop', target: (bodyNodes || [])[0]?.id || 'body', sourceHandle: 'loop-body' },
    ...((bodyNodes || []).slice(1).map((current, index) => ({
      source: bodyNodes[index].id,
      target: current.id,
    }))),
  ];
  if (continuationNodes.length) {
    edges.push({ source: 'loop', target: continuationNodes[0].id, sourceHandle: 'loop-next' });
    for (let index = 1; index < continuationNodes.length; index += 1) {
      edges.push({ source: continuationNodes[index - 1].id, target: continuationNodes[index].id });
    }
  }
  return { id: 'loop-test', name: 'loop test', nodes, edges, triggerPayload: { payload: { data: items } } };
}

async function run(workflow, { signal, integrations } = {}) {
  const id = `loop-test-exec-${executionNumber++}`;
  const state = { started: [], finished: [], logs: [], update: null };
  const persistence = {
    startExecution: async () => {},
    startNodeExecution: async (_id, record) => state.started.push(record),
    finishNodeExecution: async (_id, record) => state.finished.push(record),
    appendLog: async (_id, record) => state.logs.push(record),
    updateExecution: async (_id, record) => { state.update = record; },
  };
  const events = [];
  const subscriber = { raw: { write: (event) => events.push(event) } };
  memoryStore.addSubscriber(id, subscriber);
  try {
    await executeWorkflow(workflow, id, workflow.triggerPayload || {}, { signal, persistence, integrations });
  } finally {
    memoryStore.removeSubscriber(id, subscriber);
  }
  return { state, events };
}

function resultFor(state, nodeId) {
  return state.finished.filter((entry) => entry.nodeId === nodeId && entry.status === 'completed').at(-1)?.output;
}

test('For Each runs in order, exposes item metadata, aggregates outputs, and continues once', async () => {
  const bodyNodes = [
    node('first', 'javascript', {
      code: 'return { name: context.loop.item.name, index: context.loop.index, iteration: context.loop.iteration, total: context.loop.total };',
    }),
    node('second', 'javascript', { code: 'return context.outputs.first;' }),
  ];
  const continuation = node('after', 'javascript', { code: 'return context.outputs.loop.total;' });
  const workflow = graph({
    items: [{ name: 'Ada' }, { name: 'Lin' }],
    bodyNodes,
    continuationNodes: [continuation],
  });
  workflow.edges[2] = { source: 'first', target: 'second' };

  const { state, events } = await run(workflow);
  const output = resultFor(state, 'loop');
  assert.equal(state.update.status, 'SUCCESS');
  assert.deepEqual(output.items, [{ name: 'Ada' }, { name: 'Lin' }]);
  assert.deepEqual(output.results.map((entry) => entry.outputs.first), [
    { name: 'Ada', index: 0, iteration: 1, total: 2 },
    { name: 'Lin', index: 1, iteration: 2, total: 2 },
  ]);
  assert.deepEqual(output.results.map((entry) => entry.outputs.second), output.results.map((entry) => entry.outputs.first));
  assert.equal(resultFor(state, 'after'), 2);
  assert.equal(state.started.filter((entry) => entry.nodeId === 'after').length, 1);
  assert.deepEqual(
    state.started.filter((entry) => ['first', 'second'].includes(entry.nodeId)).map((entry) => entry.nodeId),
    ['first', 'second', 'first', 'second'],
  );
  assert.equal(resolveVariablePath('loop.item.name', { loop: { item: { name: 'Ada' } } }), 'Ada');
  assert.equal(resolveVariablePath('loop.index', { loop: { index: 3 } }), 3);
  assert.equal(resolveExpressions('{{loop.iteration}}/{{loop.total}}', { loop: { iteration: 2, total: 5 } }), '2/5');
  const telemetry = events.join('');
  assert.match(telemetry, /"status":"started"/);
  assert.match(telemetry, /"status":"iteration_started"/);
  assert.match(telemetry, /"status":"iteration_completed"/);
  assert.match(telemetry, /"completedIterations":2/);
  assert.match(telemetry, /"status":"completed"/);
});

test('Fixed Iterations runs exactly its configured count', async () => {
  const workflow = graph({
    items: [],
    loopConfig: { mode: 'fixed', iterations: 3, maxIterations: 4 },
  });
  const { state } = await run(workflow);
  const output = resultFor(state, 'loop');
  assert.equal(state.update.status, 'SUCCESS');
  assert.equal(output.total, 3);
  assert.deepEqual(output.items, [0, 1, 2]);
  assert.deepEqual(output.results.map((entry) => entry.outputs.body.index), [0, 1, 2]);
});

test('Empty arrays skip body nodes and run continuation once', async () => {
  const continuation = node('after', 'javascript', { code: 'return true;' });
  const { state } = await run(graph({ items: [], continuationNodes: [continuation] }));
  assert.deepEqual(resultFor(state, 'loop'), { items: [], results: [], total: 0, completed: true });
  assert.equal(state.started.filter((entry) => entry.nodeId === 'body').length, 0);
  assert.equal(state.started.filter((entry) => entry.nodeId === 'after').length, 1);
});

test('Missing and non-array inputs fail instead of returning a successful loop output', async () => {
  const missing = graph({ items: [] });
  missing.nodes.find((entry) => entry.id === 'loop').data.configuration.arrayExpression = '{{nodes.missing.output}}';
  const missingRun = await run(missing);
  assert.equal(missingRun.state.update.status, 'FAILED');
  assert.match(missingRun.state.update.error, /must resolve to an array/);
  assert.equal(resultFor(missingRun.state, 'loop'), undefined);

  const nonArray = graph({ items: 'not-an-array' });
  const invalidRun = await run(nonArray);
  assert.equal(invalidRun.state.update.status, 'FAILED');
  assert.match(invalidRun.state.update.error, /must resolve to an array/);
});

test('Loop limits are enforced at runtime and in node configuration validation', async () => {
  const tooManyItems = await run(graph({ items: [1, 2, 3], loopConfig: { maxIterations: 2 } }));
  assert.equal(tooManyItems.state.update.status, 'FAILED');
  assert.match(tooManyItems.state.update.error, /exceeding its maximum of 2/);

  const tooManyIterations = await run(graph({
    items: [],
    loopConfig: { mode: 'fixed', iterations: 4, maxIterations: 3 },
  }));
  assert.equal(tooManyIterations.state.update.status, 'FAILED');
  assert.match(tooManyIterations.state.update.error, /exceeds its maximum of 3/);

  const configErrors = validateNodeConfigurations([node('loop', 'loop', {
    mode: 'fixed',
    iterations: 3,
    maxIterations: 2,
  })]);
  assert.ok(configErrors[0].messages.some((message) => message.includes('cannot exceed')));
});

test('Invalid Loop configuration expressions and iteration bounds are rejected', () => {
  const errors = validateNodeConfigurations([node('loop', 'loop', {
    mode: 'forEach',
    arrayExpression: 'not an expression',
    maxIterations: 1001,
  })]);
  assert.ok(errors[0].messages.some((message) => message.includes('expression that resolves to an array')));
  assert.ok(errors[0].messages.some((message) => message.includes('1 to 1000')));
});

test('Loop body must have an explicit handle and ordinary downstream nodes stay outside it', async () => {
  const workflow = graph({ items: [1] });
  workflow.edges[1].sourceHandle = undefined;
  const invalid = await run(workflow);
  assert.equal(invalid.state.update.status, 'FAILED');
  assert.match(invalid.state.update.error, /must use the Loop Body or Continue handle/);

  const plainBody = graph({ items: [1] });
  plainBody.edges[1].sourceHandle = 'loop-body';
  const { state } = await run(plainBody);
  assert.equal(state.started.filter((entry) => entry.nodeId === 'body').length, 1);
});

test('A body failure stops the loop and identifies the failed iteration', async () => {
  const workflow = graph({
    items: ['good@example.com', 'bad@example.com', 'later@example.com'],
    loopConfig: { arrayExpression: '{{nodes.source.output.data}}' },
    bodyNodes: [node('send', 'gmail', {
      operation: 'send_email',
      to: '{{loop.item}}',
      subject: 'Test',
      body: '{{loop.index}}',
    })],
  });
  const sent = [];
  const { state } = await run(workflow, {
    integrations: {
      isGmailConnected: () => true,
      getGmailUser: () => ({ email: 'mock@example.com' }),
      sendEmail: async (message) => {
        sent.push(message);
        if (message.to === 'bad@example.com') throw new Error('mock send failure');
        return { messageId: 'mock-message' };
      },
    },
  });
  assert.equal(state.update.status, 'FAILED');
  assert.match(state.update.error, /iteration 2 \(index 1\).*mock send failure/);
  assert.deepEqual(sent.map((message) => message.to), ['good@example.com', 'bad@example.com']);
  const failedLoop = state.finished.find((entry) => entry.nodeId === 'loop' && entry.status === 'failed')?.output;
  assert.equal(failedLoop.completed, false);
  assert.equal(failedLoop.completedIterations, 1);
  assert.equal(failedLoop.failedIteration, 2);
  assert.equal(failedLoop.results.length, 1);
});

test('AI Agent and mocked Gmail can use values from the current loop item', async () => {
  const workflow = graph({
    items: [{ name: 'Ada', email: 'ada@example.com' }, { name: 'Lin', email: 'lin@example.com' }],
    bodyNodes: [
      node('agent', 'aiAgent', {
        systemInstructions: 'Summarize the person.',
        prompt: 'Prepare a greeting for {{loop.item.name}} at {{loop.index}}.',
      }),
      node('gmail', 'gmail', {
        operation: 'send_email',
        to: '{{loop.item.email}}',
        subject: 'Hello {{loop.item.name}}',
        body: '{{nodes.agent.output.text}}',
      }),
    ],
  });
  workflow.edges[2] = { source: 'agent', target: 'gmail' };

  const prompts = [];
  const messages = [];
  setMockAIProvider(async ({ prompt }) => {
    prompts.push(prompt);
    return `Greeting ${prompt}`;
  });
  try {
    const { state } = await run(workflow, {
      integrations: {
        isGmailConnected: () => true,
        getGmailUser: () => ({ email: 'mock@example.com' }),
        sendEmail: async (message) => {
          messages.push(message);
          return { messageId: `mock-${messages.length}` };
        },
      },
    });
    assert.equal(state.update.status, 'SUCCESS');
    assert.equal(prompts.length, 2);
    assert.match(prompts[0], /Ada at 0/);
    assert.match(prompts[1], /Lin at 1/);
    assert.deepEqual(messages.map((message) => message.to), ['ada@example.com', 'lin@example.com']);
    assert.match(messages[0].body, /Ada at 0/);
  } finally {
    clearMockAIProvider();
  }
});

test('AbortSignal stops a running delay in the loop body', async () => {
  const controller = new AbortController();
  const workflow = graph({
    items: [1, 2],
    bodyNodes: [node('pause', 'wait', { durationMs: 5000 })],
  });
  const pending = run(workflow, { signal: controller.signal });
  setTimeout(() => controller.abort(new Error('test cancellation')), 30);
  const { state } = await pending;
  assert.equal(state.update.status, 'FAILED');
  assert.match(state.update.error, /test cancellation/);
  assert.equal(state.started.filter((entry) => entry.nodeId === 'pause').length, 1);
});
