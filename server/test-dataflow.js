import {
  resolveExpressions,
  resolveVariablePath,
  redactSensitive,
  executeWorkflow,
} from './src/engine/executor.js';
import {
  saveWorkflowAndCreateExecution,
  getExecution,
} from './src/db/workflowRepository.js';
import { closeDB } from './src/db/db.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('--- TEST SUITE: WORKFLOW DATA FLOW & EXPRESSIONS ---');
  console.log('======================================================\n');

  try {
    // ----------------------------------------------------------------
    // 1. VARIABLE PATH RESOLUTION & EXPRESSION PARSING
    // ----------------------------------------------------------------
    console.log('1. Testing Variable Path Resolution & Expression Parsing:');

    const mockContext = {
      trigger: {
        sender: 'alex@example.com',
        body: { event: 'deploy', env: 'production' },
        repository: 'kahn-engine/core',
      },
      outputs: {
        'node-1': { status: 200, data: { count: 42 } },
        'aiAgent1': { text: 'System latency is within normal parameters.', model: 'gpt-4o-mini' },
      },
      nodes: {
        'node-1': {
          id: 'node-1',
          title: 'HTTP Request',
          type: 'httprequest',
          output: { status: 200, data: { count: 42 } },
        },
        'aiAgent1': {
          id: 'aiAgent1',
          title: 'AI Agent 1',
          type: 'aiagent',
          output: { text: 'System latency is within normal parameters.', model: 'gpt-4o-mini' },
        },
      },
    };

    const aiText = resolveVariablePath('nodes.aiAgent1.output.text', mockContext);
    assert(
      aiText === 'System latency is within normal parameters.',
      'Resolves {{nodes.aiAgent1.output.text}} correctly',
    );

    const triggerSender = resolveVariablePath('trigger.sender', mockContext);
    assert(triggerSender === 'alex@example.com', 'Resolves {{trigger.sender}}');

    const httpData = resolveVariablePath('nodes.node-1.output.data.count', mockContext);
    assert(httpData === 42, 'Resolves nested {{nodes.node-1.output.data.count}}');

    // Alias lookup (case and hyphen insensitive matching)
    const aliasLookup = resolveVariablePath('nodes.aiagent.output.text', mockContext);
    assert(
      aliasLookup === 'System latency is within normal parameters.',
      'Resolves node via normalized alias {{nodes.aiagent.output.text}}',
    );

    // Expression interpolation
    const interpolated = resolveExpressions(
      'Hello from Kahn! Report: {{nodes.aiAgent1.output.text}} - Alert sent by {{trigger.sender}}',
      mockContext,
    );
    assert(
      interpolated ===
        'Hello from Kahn! Report: System latency is within normal parameters. - Alert sent by alex@example.com',
      'Interpolates multiple {{...}} expressions in a template string',
    );

    // Exact match replacement preserving objects
    const exactObj = resolveExpressions('{{nodes.node-1.output.data}}', mockContext);
    assert(
      typeof exactObj === 'object' && exactObj.count === 42,
      'Exact match returns raw object without converting to string',
    );

    // Static configuration preservation
    const staticText = resolveExpressions('Static configuration message', mockContext);
    assert(
      staticText === 'Static configuration message',
      'Preserves static string without modifications',
    );

    // ----------------------------------------------------------------
    // 2. LOG SENSITIVE DATA REDACTION
    // ----------------------------------------------------------------
    console.log('\n2. Testing Sensitive Data Redaction:');

    const rawLog = 'Connecting with Bearer ya29.a0AfH6SMB... and sk-proj-12345678901234567890 with password=mySecretPass123';
    const redacted = redactSensitive(rawLog);
    assert(
      !redacted.includes('ya29.a0AfH6SMB') && redacted.includes('Bearer [REDACTED]'),
      'Redacts Bearer authorization tokens',
    );
    assert(
      !redacted.includes('sk-proj-12345678901234567890') && redacted.includes('sk-[REDACTED]'),
      'Redacts OpenAI/secret API keys',
    );
    assert(
      !redacted.includes('mySecretPass123') && redacted.includes('password=[REDACTED]'),
      'Redacts password fields',
    );

    // ----------------------------------------------------------------
    // 3. END-TO-END WORKFLOW EXECUTION: Trigger -> AI Agent -> Gmail
    // ----------------------------------------------------------------
    console.log('\n3. Testing Complete End-to-End Workflow (Trigger -> AI Agent -> Gmail):');

    // Workflow Test Case A: Dynamic mapping configured in Gmail node
    const workflowA = {
      name: 'Test Workflow Dynamic Flow',
      nodes: [
        {
          id: 'trigger-1',
          type: 'workflow',
          data: {
            configType: 'webhook',
            title: 'Webhook Trigger',
            configuration: {},
          },
        },
        {
          id: 'aiAgent1',
          type: 'workflow',
          data: {
            configType: 'aiAgent',
            title: 'AI Agent',
            configuration: {
              prompt: 'Generate an executive summary of server operations.',
              systemPrompt: 'You are an operations assistant.',
            },
          },
        },
        {
          id: 'gmail-1',
          type: 'workflow',
          data: {
            configType: 'gmail',
            title: 'Gmail',
            configuration: {
              operation: 'send_email',
              to: 'ops-lead@company.com',
              subject: 'Daily Operations Digest',
              body: 'Summary from AI:\n{{nodes.aiAgent1.output.text}}',
            },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'aiAgent1' },
        { id: 'e2', source: 'aiAgent1', target: 'gmail-1' },
      ],
    };

    const { workflow: savedWfA, execution: execA } = await saveWorkflowAndCreateExecution(workflowA, {
      triggerPayload: { sender: 'system@company.com' },
    });

    await executeWorkflow(savedWfA, execA.id, { sender: 'system@company.com' });

    const finalExecA = await getExecution(execA.id);
    const stepsA = finalExecA.steps || [];
    const aiStepA = stepsA.find((s) => s.nodeId === 'aiAgent1');
    const gmailStepA = stepsA.find((s) => s.nodeId === 'gmail-1');

    assert(
      Boolean(aiStepA?.output?.text || aiStepA?.output?.completion),
      'AI Agent executed in workflow and returned text response',
    );

    const expectedAiText = aiStepA?.output?.text || aiStepA?.output?.completion;
    assert(
      typeof gmailStepA?.output?.body === 'string' && gmailStepA.output.body.includes(expectedAiText),
      'Gmail node resolved email body and contains the actual AI-generated response',
    );

    assert(
      gmailStepA?.output?.recipient === 'ops-lead@company.com',
      'Gmail node preserves configured recipient',
    );

    // Check logs for resolved email content
    const logsA = finalExecA.logs || [];
    const emailLogA = logsA.find((l) => l.message?.includes('Resolved email content'));
    assert(
      Boolean(emailLogA) && emailLogA.message.includes(expectedAiText),
      'Execution log displays resolved email content with AI output',
    );

    // ----------------------------------------------------------------
    // 4. TEST FALLBACK BEHAVIOR:
    // ----------------------------------------------------------------
    console.log('\n4. Testing Fallback Behaviors:');

    // Case B: Gmail has no body configured; should automatically fall back to predecessor AI Agent output
    const workflowB = {
      name: 'Test Workflow Fallback Flow',
      nodes: [
        {
          id: 'aiAgent1',
          type: 'workflow',
          data: {
            configType: 'aiAgent',
            title: 'AI Agent',
            configuration: { prompt: 'Quick update' },
          },
        },
        {
          id: 'gmail-1',
          type: 'workflow',
          data: {
            configType: 'gmail',
            title: 'Gmail',
            configuration: {
              operation: 'send_email',
              to: 'alerts@company.com',
              // No body configured!
            },
          },
        },
      ],
      edges: [{ id: 'e1', source: 'aiAgent1', target: 'gmail-1' }],
    };

    const { workflow: savedWfB, execution: execB } = await saveWorkflowAndCreateExecution(workflowB, {
      triggerPayload: {},
    });

    await executeWorkflow(savedWfB, execB.id, {});
    const finalExecB = await getExecution(execB.id);
    const stepsB = finalExecB.steps || [];
    const aiStepB = stepsB.find((s) => s.nodeId === 'aiAgent1');
    const gmailStepB = stepsB.find((s) => s.nodeId === 'gmail-1');

    assert(
      typeof gmailStepB?.output?.body === 'string' &&
        gmailStepB.output.body.includes(aiStepB.output.text || aiStepB.output.completion),
      'When body is blank, Gmail falls back to predecessor AI Agent output automatically',
    );

    // Case C: Gmail has static body; should preserve static configuration when no dynamic expression is provided
    const workflowC = {
      name: 'Test Workflow Static Flow',
      nodes: [
        {
          id: 'aiAgent1',
          type: 'workflow',
          data: {
            configType: 'aiAgent',
            title: 'AI Agent',
            configuration: { prompt: 'Quick update' },
          },
        },
        {
          id: 'gmail-1',
          type: 'workflow',
          data: {
            configType: 'gmail',
            title: 'Gmail',
            configuration: {
              operation: 'send_email',
              to: 'alerts@company.com',
              subject: 'Static Alert',
              body: 'This is a strictly static message that must not be overwritten.',
            },
          },
        },
      ],
      edges: [{ id: 'e1', source: 'aiAgent1', target: 'gmail-1' }],
    };

    const { workflow: savedWfC, execution: execC } = await saveWorkflowAndCreateExecution(workflowC, {
      triggerPayload: {},
    });

    await executeWorkflow(savedWfC, execC.id, {});
    const finalExecC = await getExecution(execC.id);
    const stepsC = finalExecC.steps || [];
    const gmailStepC = stepsC.find((s) => s.nodeId === 'gmail-1');

    assert(
      gmailStepC?.output?.body === 'This is a strictly static message that must not be overwritten.',
      'Preserves static configuration when no dynamic mapping expression is configured',
    );

  } finally {
    await closeDB();
  }

  console.log('\n======================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
