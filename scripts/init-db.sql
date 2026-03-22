CREATE TABLE IF NOT EXISTS captures (
  id            BIGINT PRIMARY KEY,
  session_id    TEXT NOT NULL,
  ts            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method        TEXT NOT NULL DEFAULT 'POST',
  path          TEXT NOT NULL DEFAULT '/',
  request_body  JSONB,
  response_body JSONB,
  status_code   INTEGER,
  latency_ms    INTEGER,
  mechanisms    JSONB,
  model         TEXT,
  input_tokens  INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_read_tokens  INTEGER DEFAULT 0,
  cache_write_tokens INTEGER DEFAULT 0,
  cost          DOUBLE PRECISION DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_captures_session ON captures(session_id);
CREATE INDEX IF NOT EXISTS idx_captures_ts ON captures(ts DESC);
