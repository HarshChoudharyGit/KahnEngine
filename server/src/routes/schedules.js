import {
  registerSchedule,
  updateSchedule,
  removeSchedule,
  getSchedule,
  listSchedules,
  executeScheduledWorkflow,
  validateCronExpression,
  describeSchedule,
} from '../services/scheduleService.js';

export async function scheduleRoutes(fastify) {
  // 1. Validate Cron expression endpoint
  fastify.post('/api/v1/schedules/validate', async (request, reply) => {
    const { cronExpression, timezone = 'Asia/Kolkata' } = request.body || {};
    const validation = validateCronExpression(cronExpression);

    if (!validation.valid) {
      return reply.code(400).send({
        success: false,
        valid: false,
        error: validation.error,
        summary: null,
      });
    }

    const summary = describeSchedule(cronExpression, timezone);
    return {
      success: true,
      valid: true,
      error: null,
      summary,
    };
  });

  // 2. List all schedules (optionally filtered by workflowId)
  fastify.get('/api/v1/schedules', async (request) => {
    const { workflowId } = request.query || {};
    const schedules = listSchedules(workflowId);
    return {
      success: true,
      schedules,
      count: schedules.length,
    };
  });

  // 3. Get single schedule by ID
  fastify.get('/api/v1/schedules/:id', async (request, reply) => {
    const { id } = request.params;
    const schedule = getSchedule(id);
    if (!schedule) {
      return reply.code(404).send({
        success: false,
        error: `Schedule "${id}" not found.`,
      });
    }
    return {
      success: true,
      schedule,
    };
  });

  // 4. Create / Register a new schedule (or replace if already exists)
  fastify.post('/api/v1/schedules', async (request, reply) => {
    const body = request.body || {};
    const { workflowId, cronExpression } = body;

    if (!workflowId) {
      return reply.code(400).send({
        success: false,
        error: 'workflowId is required to register a schedule.',
      });
    }

    if (!cronExpression) {
      return reply.code(400).send({
        success: false,
        error: 'cronExpression is required.',
      });
    }

    const validation = validateCronExpression(cronExpression);
    if (!validation.valid) {
      return reply.code(400).send({
        success: false,
        error: validation.error,
      });
    }

    try {
      const schedule = registerSchedule(body);
      return reply.code(201).send({
        success: true,
        schedule,
        message: schedule.enabled
          ? `Schedule active: ${schedule.summary}`
          : 'Schedule registered in paused state',
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({
        success: false,
        error: err.message,
      });
    }
  });

  // 5. Update an existing schedule
  fastify.put('/api/v1/schedules/:id', async (request, reply) => {
    const { id } = request.params;
    const body = request.body || {};

    if (body.cronExpression) {
      const validation = validateCronExpression(body.cronExpression);
      if (!validation.valid) {
        return reply.code(400).send({
          success: false,
          error: validation.error,
        });
      }
    }

    try {
      const updated = updateSchedule(id, body);
      return {
        success: true,
        schedule: updated,
        message: 'Schedule updated successfully.',
      };
    } catch (err) {
      return reply.code(404).send({
        success: false,
        error: err.message,
      });
    }
  });

  // 6. Partial update / Enable / Disable schedule toggle
  fastify.patch('/api/v1/schedules/:id', async (request, reply) => {
    const { id } = request.params;
    const body = request.body || {};

    try {
      const updated = updateSchedule(id, body);
      return {
        success: true,
        schedule: updated,
      };
    } catch (err) {
      return reply.code(404).send({
        success: false,
        error: err.message,
      });
    }
  });

  // 7. Delete / Remove schedule
  fastify.delete('/api/v1/schedules/:id', async (request, reply) => {
    const { id } = request.params;
    const removed = removeSchedule(id);
    if (!removed) {
      return reply.code(404).send({
        success: false,
        error: `Schedule "${id}" not found.`,
      });
    }

    return {
      success: true,
      message: 'Schedule removed and cron task stopped successfully.',
    };
  });

  // 8. Test Run Now (Immediate execution of scheduled workflow)
  fastify.post('/api/v1/schedules/:id/run', async (request, reply) => {
    const { id } = request.params;
    const schedule = getSchedule(id);
    if (!schedule) {
      return reply.code(404).send({
        success: false,
        error: `Schedule "${id}" not found.`,
      });
    }

    try {
      const executionResult = await executeScheduledWorkflow(id, true);
      return reply.code(202).send({
        success: true,
        executionResult,
        message: 'Scheduled workflow execution triggered manually.',
      });
    } catch (err) {
      return reply.code(500).send({
        success: false,
        error: err.message,
      });
    }
  });
}
