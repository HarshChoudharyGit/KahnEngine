import Fastify from 'fastify';
import cors from '@fastify/cors';
import { scheduleRoutes } from './src/routes/schedules.js';
import { workflowRoutes } from './src/routes/workflows.js';
import { memoryStore } from './src/store/memoryStore.js';
import {
  validateCronExpression,
  describeSchedule,
  registerSchedule,
  updateSchedule,
  toggleSchedule,
  removeSchedule,
  getSchedule,
  listSchedules,
  executeScheduledWorkflow,
} from './src/services/scheduleService.js';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    testsFailed++;
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('--- TESTING SCHEDULE TRIGGER SERVICE ---');
  console.log('========================================\n');

  // Test 1: Cron Expression Validation
  console.log('1. Testing Cron Expression Validation...');
  const valid1 = validateCronExpression('*/1 * * * *');
  assert(valid1.valid === true, 'Validates every-minute cron "*/1 * * * *"');

  const valid2 = validateCronExpression('0 9 * * 1-5');
  assert(valid2.valid === true, 'Validates workday 9am cron "0 9 * * 1-5"');

  const valid3 = validateCronExpression('30 14 1 * *');
  assert(valid3.valid === true, 'Validates monthly 1st at 14:30 "30 14 1 * *"');

  const invalidFieldCount = validateCronExpression('* * * *');
  assert(invalidFieldCount.valid === false, 'Rejects 4-field cron');

  const invalidChars = validateCronExpression('abc * * * *');
  assert(invalidChars.valid === false, 'Rejects invalid field characters "abc"');

  const invalidMinute = validateCronExpression('65 * * * *');
  assert(invalidMinute.valid === false, 'Rejects minute > 59');

  // Test 2: Human-readable Summary
  console.log('\n2. Testing Schedule Summary Generation...');
  const sum1 = describeSchedule('*/1 * * * *', 'Asia/Kolkata');
  assert(sum1.includes('minute') && sum1.includes('Asia/Kolkata'), `Generates summary for */1: "${sum1}"`);

  const sumDaily = describeSchedule('30 9 * * *', 'Asia/Kolkata');
  assert(sumDaily.includes('09:30') && sumDaily.includes('Daily'), `Generates daily summary: "${sumDaily}"`);

  const sumWeekly = describeSchedule('0 10 * * 1,3,5', 'Asia/Kolkata');
  assert(sumWeekly.includes('Weekly') && sumWeekly.includes('Mon'), `Generates weekly summary: "${sumWeekly}"`);

  // Test 3: Schedule Registration & In-Memory Storage
  console.log('\n3. Testing In-Memory Schedule Registration...');
  const testWfId = 'wf_test_sched_001';
  const triggerNodeId = 'node_schedule_trigger_1';

  // Seed workflow in memoryStore
  memoryStore.saveWorkflow({
    id: testWfId,
    name: 'Scheduled Alert Workflow',
    nodes: [
      {
        id: triggerNodeId,
        type: 'workflow',
        data: {
          title: 'Schedule Trigger',
          configType: 'scheduleTrigger',
          configuration: {
            cronExpression: '*/1 * * * *',
            timezone: 'Asia/Kolkata',
            enabled: true,
          },
        },
      },
      {
        id: 'node_gmail_action_1',
        type: 'workflow',
        data: {
          title: 'Gmail Alert',
          configType: 'gmail',
          configuration: {
            operation: 'send_email',
            to: 'ops-team@test.local',
            subject: 'Automated Status Alert',
            body: '',
          },
        },
      },
    ],
    edges: [
      {
        id: 'e-1-2',
        source: triggerNodeId,
        target: 'node_gmail_action_1',
      },
    ],
  });

  const registered = registerSchedule({
    workflowId: testWfId,
    triggerNodeId,
    cronExpression: '*/1 * * * *',
    timezone: 'Asia/Kolkata',
    enabled: true,
    summary: 'Every minute (Asia/Kolkata)',
  });

  assert(registered.id.includes(testWfId), `Schedule created with id "${registered.id}"`);
  assert(registered.enabled === true, 'Schedule marked as enabled');
  assert(registered.status === 'ACTIVE', 'Schedule status is ACTIVE');
  assert(registered.hasActiveTask === true, 'Has active in-memory cron task');
  assert(registered.timezone === 'Asia/Kolkata', 'Configured with timezone Asia/Kolkata');

  // Test 4: Duplicate Prevention on Update
  console.log('\n4. Testing Duplicate Task Prevention on Update...');
  const updated = updateSchedule(registered.id, {
    cronExpression: '*/5 * * * *',
    summary: 'Every 5 minutes (Asia/Kolkata)',
  });

  assert(updated.cronExpression === '*/5 * * * *', 'Cron expression updated to */5 * * * *');
  assert(updated.hasActiveTask === true, 'Re-registers single active task without duplicates');

  const allSchedules = listSchedules(testWfId);
  assert(allSchedules.length === 1, `Exactly 1 schedule entry exists for workflow (found ${allSchedules.length})`);

  // Test 5: Disabling and Enabling Schedules
  console.log('\n5. Testing Disable & Enable Controls...');
  const disabled = toggleSchedule(registered.id, false);
  assert(disabled.enabled === false, 'Schedule toggled to disabled');
  assert(disabled.status === 'PAUSED', 'Status updated to PAUSED');
  assert(disabled.hasActiveTask === false, 'Active cron task stopped when disabled');

  const reenabled = toggleSchedule(registered.id, true);
  assert(reenabled.enabled === true, 'Schedule re-enabled');
  assert(reenabled.status === 'ACTIVE', 'Status restored to ACTIVE');
  assert(reenabled.hasActiveTask === true, 'Cron task restarted');

  // Test 6: Workflow Execution Triggering
  console.log('\n6. Testing Scheduled Workflow Execution Dispatch...');
  const execResult = await executeScheduledWorkflow(registered.id, true);
  assert(Boolean(execResult.executionId), `Execution dispatched with ID: ${execResult.executionId}`);

  // Wait briefly for the setImmediate execution to finish
  await new Promise((resolve) => setTimeout(resolve, 800));

  const executionRecord = memoryStore.getExecution(execResult.executionId);
  assert(executionRecord !== null, 'Execution record saved in memoryStore');
  assert(executionRecord.status === 'SUCCESS', `Execution status is SUCCESS (got: ${executionRecord.status})`);
  assert(executionRecord.steps.length >= 2, `Both Schedule Trigger and Gmail Action executed (steps: ${executionRecord.steps.length})`);

  const schedNodeStep = executionRecord.steps.find((s) => s.nodeId === triggerNodeId);
  assert(schedNodeStep?.status === 'SUCCESS', 'Schedule Trigger node succeeded');

  const gmailNodeStep = executionRecord.steps.find((s) => s.nodeId === 'node_gmail_action_1');
  assert(gmailNodeStep?.status === 'SUCCESS', 'Downstream Gmail Action executed successfully');

  // Verify schedule stats updated
  const updatedSchedAfterRun = getSchedule(registered.id);
  assert(updatedSchedAfterRun.runCount >= 1, `Run count incremented to ${updatedSchedAfterRun.runCount}`);
  assert(Boolean(updatedSchedAfterRun.lastRunAt), `Last run timestamp recorded: ${updatedSchedAfterRun.lastRunAt}`);

  // Test 7: Schedule Removal
  console.log('\n7. Testing Schedule Deletion...');
  const removed = removeSchedule(registered.id);
  assert(removed === true, 'Schedule removed from memory');
  assert(getSchedule(registered.id) === null, 'Schedule no longer exists in lookup');

  // Test 8: Fastify REST API Endpoints
  console.log('\n8. Testing Fastify Schedule API Endpoints...');
  const fastify = Fastify();
  await fastify.register(cors, { origin: true });
  await fastify.register(workflowRoutes);
  await fastify.register(scheduleRoutes);

  // 8a: Validation Endpoint
  const valResponse = await fastify.inject({
    method: 'POST',
    url: '/api/v1/schedules/validate',
    payload: { cronExpression: '*/1 * * * *', timezone: 'Asia/Kolkata' },
  });
  const valBody = JSON.parse(valResponse.body);
  assert(valResponse.statusCode === 200 && valBody.valid === true, 'POST /api/v1/schedules/validate accepts valid expression');

  const invalidValResponse = await fastify.inject({
    method: 'POST',
    url: '/api/v1/schedules/validate',
    payload: { cronExpression: 'invalid_cron', timezone: 'Asia/Kolkata' },
  });
  assert(invalidValResponse.statusCode === 400, 'POST /api/v1/schedules/validate rejects invalid expression with 400');

  // 8b: Register Schedule API
  const regResponse = await fastify.inject({
    method: 'POST',
    url: '/api/v1/schedules',
    payload: {
      workflowId: testWfId,
      triggerNodeId,
      cronExpression: '*/1 * * * *',
      timezone: 'Asia/Kolkata',
      enabled: true,
      summary: 'API Test Schedule',
    },
  });
  assert(regResponse.statusCode === 201, 'POST /api/v1/schedules returns 201 Created');
  const regData = JSON.parse(regResponse.body);
  const createdSchedId = regData.schedule?.id;
  assert(Boolean(createdSchedId), `Created schedule via API with ID: ${createdSchedId}`);

  // 8c: Get Schedule by ID
  const getResponse = await fastify.inject({
    method: 'GET',
    url: `/api/v1/schedules/${createdSchedId}`,
  });
  assert(getResponse.statusCode === 200, 'GET /api/v1/schedules/:id returns 200 OK');

  // 8d: List Schedules
  const listResponse = await fastify.inject({
    method: 'GET',
    url: `/api/v1/schedules?workflowId=${testWfId}`,
  });
  const listData = JSON.parse(listResponse.body);
  assert(listResponse.statusCode === 200 && listData.schedules.length === 1, 'GET /api/v1/schedules lists schedules');

  // 8e: Toggle Schedule
  const toggleResponse = await fastify.inject({
    method: 'PATCH',
    url: `/api/v1/schedules/${createdSchedId}`,
    payload: { enabled: false },
  });
  const toggleData = JSON.parse(toggleResponse.body);
  assert(toggleResponse.statusCode === 200 && toggleData.schedule.enabled === false, 'PATCH /api/v1/schedules/:id disables schedule');

  // 8f: Run Schedule Immediately via API
  const runNowResponse = await fastify.inject({
    method: 'POST',
    url: `/api/v1/schedules/${createdSchedId}/run`,
  });
  assert(runNowResponse.statusCode === 202, 'POST /api/v1/schedules/:id/run dispatches execution with 202 Accepted');

  // 8g: Delete Schedule API
  const delResponse = await fastify.inject({
    method: 'DELETE',
    url: `/api/v1/schedules/${createdSchedId}`,
  });
  assert(delResponse.statusCode === 200, 'DELETE /api/v1/schedules/:id returns 200');

  // Summary
  console.log('\n========================================');
  console.log(`TEST RESULTS: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('========================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
