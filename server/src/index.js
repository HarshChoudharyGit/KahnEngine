import Fastify from 'fastify';
import cors from '@fastify/cors';
import { workflowRoutes } from './routes/workflows.js';
import { webhookRoutes } from './routes/webhooks.js';
import { telemetryRoutes } from './routes/telemetry.js';
import { integrationRoutes } from './routes/integrations.js';
import { gmailRoutes } from './routes/gmail.js';
import { startGitHubWatcher, stopGitHubWatcher } from './services/githubWatcher.js';
import { closeDB, connectDB } from './db/db.js';
import { runMigrations } from './db/migrate.js';
import { initializeGitHubSession } from './engine/agent/octokitClient.js';
import { initializeGmailSession } from './engine/agent/gmailClient.js';

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

fastify.addHook('onClose', async () => {
  stopGitHubWatcher();
  await closeDB();
});

async function shutdown(signal) {
  fastify.log.info({ signal }, 'Shutting down server');
  try {
    await fastify.close();
  } catch (err) {
    fastify.log.error({ err }, 'Server shutdown failed');
    process.exitCode = 1;
  }
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await connectDB();
  await runMigrations();
  await initializeGitHubSession();
  await initializeGmailSession();
  await fastify.listen({ port, host });
  startGitHubWatcher(10000);
} catch (err) {
  fastify.log.error({
    message: err.message,
    code: err.cause?.code || err.code || 'UNKNOWN',
  }, 'Server startup failed');
  await closeDB();
  process.exitCode = 1;
}
