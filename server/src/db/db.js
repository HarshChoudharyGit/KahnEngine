import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be configured in server/.env or the server environment');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error', { code: err.code || 'UNKNOWN' });
});

export async function connectDB() {
  try {
    await pool.query('SELECT 1');
    console.info('PostgreSQL connection verified');
  } catch (err) {
    console.error('PostgreSQL connection failed', { code: err.code || 'UNKNOWN' });
    throw new Error('Unable to connect to PostgreSQL', { cause: err });
  }
}

export async function closeDB() {
  await pool.end();
}
