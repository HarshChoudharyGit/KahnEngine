import { closeDB } from './db.js';
import { runMigrations } from './migrate.js';

try {
  await runMigrations();
  console.info('Database migrations are up to date');
} catch (err) {
  console.error({
    message: err.message,
    code: err.cause?.code || 'UNKNOWN',
    detail: err.cause?.message,
  });
  process.exitCode = 1;
} finally {
  await closeDB();
}
