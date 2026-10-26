import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { pool } from './db.js';

function encryptionKey() {
  const configured = process.env.SESSION_ENCRYPTION_KEY || '';
  if (!/^[a-f\d]{64}$/i.test(configured)) {
    throw new Error('SESSION_ENCRYPTION_KEY must be a 64-character hexadecimal key');
  }
  return Buffer.from(configured, 'hex');
}

function encrypt(payload) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), nonce);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return {
    encryptedPayload: encrypted.toString('base64'),
    nonce: nonce.toString('base64'),
    authenticationTag: cipher.getAuthTag().toString('base64'),
  };
}

function decrypt(row) {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(row.nonce, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(row.authentication_tag, 'base64'));
  const payload = Buffer.concat([
    decipher.update(Buffer.from(row.encrypted_payload, 'base64')),
    decipher.final(),
  ]).toString('utf8');
  return { payload: JSON.parse(payload), user: row.user_profile };
}

export async function getIntegrationSession(provider) {
  const { rows } = await pool.query(
    'SELECT encrypted_payload, nonce, authentication_tag, user_profile, connected FROM integration_sessions WHERE provider = $1',
    [provider],
  );
  if (rows[0] && !rows[0].connected) return { connected: false };
  if (!rows[0]) return null;
  try {
    return decrypt(rows[0]);
  } catch (err) {
    throw new Error(`Could not decrypt persisted ${provider} OAuth session; verify SESSION_ENCRYPTION_KEY`, {
      cause: err,
    });
  }
}

export async function saveIntegrationSession(provider, payload, user) {
  const encrypted = encrypt(payload);
  await pool.query(
    `INSERT INTO integration_sessions
       (provider, encrypted_payload, nonce, authentication_tag, user_profile)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (provider) DO UPDATE SET
       encrypted_payload = EXCLUDED.encrypted_payload,
       nonce = EXCLUDED.nonce,
       authentication_tag = EXCLUDED.authentication_tag,
       user_profile = EXCLUDED.user_profile,
       connected = true,
       updated_at = now()`,
    [
      provider,
      encrypted.encryptedPayload,
      encrypted.nonce,
      encrypted.authenticationTag,
      JSON.stringify(user || {}),
    ],
  );
}

export async function disconnectIntegrationSession(provider) {
  await pool.query(
    `UPDATE integration_sessions
     SET encrypted_payload = '', nonce = '', authentication_tag = '',
         user_profile = '{}'::jsonb, connected = false, updated_at = now()
     WHERE provider = $1`,
    [provider],
  );
}
