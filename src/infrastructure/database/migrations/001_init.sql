CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  venue TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CANCELLED'))
);

CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  customer_ref TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS reservations_event_status_idx ON reservations (event_id, status, expires_at);

CREATE TABLE IF NOT EXISTS payment_attempts (
  id UUID PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES reservations(id),
  scenario TEXT NOT NULL CHECK (scenario IN ('success', 'failure', 'slow')),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_attempts_reservation_idx ON payment_attempts (reservation_id, created_at);
