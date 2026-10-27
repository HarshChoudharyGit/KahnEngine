ALTER TABLE integration_sessions ADD COLUMN IF NOT EXISTS connected boolean NOT NULL DEFAULT true;
