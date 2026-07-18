CREATE TABLE IF NOT EXISTS automation_delivery_log (
  event_key TEXT PRIMARY KEY,
  workflow TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error_message TEXT
);
