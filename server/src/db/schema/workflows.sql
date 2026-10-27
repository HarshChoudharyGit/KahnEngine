CREATE TABLE workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  name varchar(255) NOT NULL,
  description text,
  status varchar(20) NOT NULL DEFAULT 'draft',
  definition jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workflows_status_check CHECK (status IN ('draft', 'active', 'archived')),
  CONSTRAINT workflows_version_check CHECK (version > 0),
  CONSTRAINT workflows_definition_object CHECK (jsonb_typeof(definition) = 'object'),
  CONSTRAINT workflows_definition_graph CHECK (
    jsonb_typeof(definition->'nodes') = 'array'
    AND jsonb_typeof(definition->'edges') = 'array'
  )
);

CREATE INDEX workflows_updated_at_idx ON workflows (updated_at DESC);
