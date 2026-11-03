import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Pool } from 'pg';
import { buildApp } from '../src/app.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = buildApp(pool, { reservationTtlMinutes: 15, paymentSlowMs: 1, reservationHoldMs: 120, jwtSecret: 'test-secret-test-secret-test-secret-0123', tokenTtlMinutes: 60, cookieSecure: false });
before(async () => {
  await app.ready();
  await pool.query('TRUNCATE payment_attempts, reservations');
});
after(async () => { await app.close(); await pool.end(); });

test('une seule demande doit occuper la dernière place', async () => {
  const requests = ['client-a', 'client-b'].map(customerRef => app.inject({
    method: 'POST', url: '/api/reservations',
    payload: { eventId: 'atelier-une-place', customerRef },
  }));
  const responses = await Promise.all(requests);
  const accepted = responses.filter(response => response.statusCode === 201).length;
  const result = await pool.query<{ active: number }>(
    "SELECT count(*)::int AS active FROM reservations WHERE event_id = 'atelier-une-place' AND status IN ('PENDING','CONFIRMED')",
  );
  assert.ok(result.rows[0].active <= 1, `Deux demandes ont été acceptées (${accepted}) pour une seule place.`);
});
