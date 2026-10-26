CREATE TABLE IF NOT EXISTS github_watcher_cursors (
  workflow_id text NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  repository text NOT NULL,
  branch text NOT NULL,
  last_sha text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workflow_id, repository, branch)
);
