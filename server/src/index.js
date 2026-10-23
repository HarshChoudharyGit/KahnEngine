import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { workflowRoutes } from './routes/workflows.js';
import { webhookRoutes } from './routes/webhooks.js';
import { telemetryRoutes } from './routes/telemetry.js';
import { integrationRoutes } from './routes/integrations.js';
import { gmailRoutes } from './routes/gmail.js';
import { startGitHubWatcher } from './services/githubWatcher.js';

dotenv.config();

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';

const fastify = Fastify({
  logger: true,
});

await fastify.register(cors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

fastify.get('/health', async () => ({
  status: 'ok',
  service: 'kahn-engine-gateway',
  timestamp: new Date().toISOString(),
}));

await fastify.register(workflowRoutes);
await fastify.register(webhookRoutes);
await fastify.register(telemetryRoutes);
await fastify.register(integrationRoutes);
await fastify.register(gmailRoutes);

try {
  await fastify.listen({ port, host });
  startGitHubWatcher(10000);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
