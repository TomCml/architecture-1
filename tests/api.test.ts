import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { Pool } from 'pg';
import { buildApp } from '../src/app.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = buildApp(pool, { reservationTtlMinutes: 15, paymentSlowMs: 1, reservationHoldMs: 0, jwtSecret: 'test-secret-test-secret-test-secret-0123', tokenTtlMinutes: 60, cookieSecure: false });

before(async () => { await app.ready(); });
beforeEach(async () => { await pool.query('TRUNCATE payment_attempts, reservations'); });
after(async () => { await app.close(); await pool.end(); });

test('le catalogue et la page d’accueil sont accessibles', async () => {
  const catalogue = await app.inject({ method: 'GET', url: '/api/events' });
  assert.equal(catalogue.statusCode, 200);
  const events = catalogue.json().events;
  assert.ok(events.some((event: { id: string }) => event.id === 'atelier-une-place'));
  const home = await app.inject({ method: 'GET', url: '/' });
  assert.equal(home.statusCode, 200);
  assert.match(home.body, /Billetterie/);
});

test('une réservation payée devient confirmée et occupe la place', async () => {
  const created = await app.inject({ method: 'POST', url: '/api/reservations', payload: { eventId: 'atelier-une-place', customerRef: 'client-test' } });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().reservation.status, 'PENDING');
  const id = created.json().reservation.id;
  const paid = await app.inject({ method: 'POST', url: `/api/reservations/${id}/checkout`, payload: { scenario: 'success' } });
  assert.equal(paid.statusCode, 200);
  assert.equal(paid.json().reservation.status, 'CONFIRMED');
  assert.equal(paid.json().paymentAttempt.status, 'SUCCEEDED');
  const state = await app.inject({ method: 'GET', url: `/api/reservations/${id}` });
  assert.equal(state.json().reservation.paymentAttempts.length, 1);
  const event = await app.inject({ method: 'GET', url: '/api/events/atelier-une-place' });
  assert.equal(event.json().event.available, 0);
});

test('un paiement refusé libère la place', async () => {
  const first = await app.inject({ method: 'POST', url: '/api/reservations', payload: { eventId: 'atelier-une-place', customerRef: 'client-a' } });
  const id = first.json().reservation.id;
  const denied = await app.inject({ method: 'POST', url: `/api/reservations/${id}/checkout`, payload: { scenario: 'failure' } });
  assert.equal(denied.json().reservation.status, 'FAILED');
  const second = await app.inject({ method: 'POST', url: '/api/reservations', payload: { eventId: 'atelier-une-place', customerRef: 'client-b' } });
  assert.equal(second.statusCode, 201);
});

test('une réponse lente conserve un état en attente', async () => {
  const created = await app.inject({ method: 'POST', url: '/api/reservations', payload: { eventId: 'atelier-une-place', customerRef: 'client-test' } });
  const id = created.json().reservation.id;
  const checkout = await app.inject({ method: 'POST', url: `/api/reservations/${id}/checkout`, payload: { scenario: 'slow' } });
  assert.equal(checkout.statusCode, 200);
  assert.equal(checkout.json().reservation.status, 'PENDING');
  assert.equal(checkout.json().paymentAttempt.status, 'PENDING');
});

test('une réservation expirée libère la place et ne peut plus être payée', async () => {
  const created = await app.inject({ method: 'POST', url: '/api/reservations', payload: { eventId: 'atelier-une-place', customerRef: 'client-a' } });
  const id = created.json().reservation.id;
  await pool.query("UPDATE reservations SET expires_at = now() - interval '1 second' WHERE id = $1", [id]);
  const state = await app.inject({ method: 'GET', url: `/api/reservations/${id}` });
  assert.equal(state.json().reservation.status, 'EXPIRED');
  const checkout = await app.inject({ method: 'POST', url: `/api/reservations/${id}/checkout`, payload: { scenario: 'success' } });
  assert.equal(checkout.statusCode, 410);
  const next = await app.inject({ method: 'POST', url: '/api/reservations', payload: { eventId: 'atelier-une-place', customerRef: 'client-b' } });
  assert.equal(next.statusCode, 201);
});

test('les erreurs distinguent entrée invalide, événement absent et vente complète', async () => {
  const invalid = await app.inject({ method: 'POST', url: '/api/reservations', payload: { eventId: '', customerRef: '' } });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error.code, 'INVALID_INPUT');
  const missing = await app.inject({ method: 'POST', url: '/api/reservations', payload: { eventId: 'inconnu', customerRef: 'client' } });
  assert.equal(missing.statusCode, 404);
  await app.inject({ method: 'POST', url: '/api/reservations', payload: { eventId: 'atelier-une-place', customerRef: 'client-a' } });
  const full = await app.inject({ method: 'POST', url: '/api/reservations', payload: { eventId: 'atelier-une-place', customerRef: 'client-b' } });
  assert.equal(full.statusCode, 409);
  assert.equal(full.json().error.code, 'SOLD_OUT');
});

async function installEvent(id: string, status: 'OPEN' | 'CANCELLED') {
  await pool.query(
    `INSERT INTO events (id, title, venue, starts_at, capacity, status)
     VALUES ($1, 'Événement de test', 'Salle de test', '2027-09-01 20:00:00+02', 10, $2)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
    [id, status],
  );
}

async function countReservations(eventId: string): Promise<number> {
  const result = await pool.query<{ count: number }>('SELECT count(*)::int AS count FROM reservations WHERE event_id = $1', [eventId]);
  return result.rows[0].count;
}

test('un événement annulé refuse toute nouvelle réservation', async () => {
  await installEvent('test-annule', 'CANCELLED');
  const refused = await app.inject({ method: 'POST', url: '/api/reservations', payload: { eventId: 'test-annule', customerRef: 'client-test' } });
  assert.equal(refused.statusCode, 409);
  assert.equal(refused.json().error.code, 'EVENT_CANCELLED');
  assert.equal(await countReservations('test-annule'), 0);
});

test('l’annulation survenue après la consultation est prise en compte à la réservation', async () => {
  await installEvent('test-annule-apres-consultation', 'OPEN');
  const consulted = await app.inject({ method: 'GET', url: '/api/events/test-annule-apres-consultation' });
  assert.equal(consulted.json().event.status, 'OPEN');
  await installEvent('test-annule-apres-consultation', 'CANCELLED');
  const refused = await app.inject({ method: 'POST', url: '/api/reservations', payload: { eventId: 'test-annule-apres-consultation', customerRef: 'client-test' } });
  assert.equal(refused.statusCode, 409);
  assert.equal(refused.json().error.code, 'EVENT_CANCELLED');
  assert.equal(await countReservations('test-annule-apres-consultation'), 0);
});

test('un identifiant de réservation mal formé reçoit une erreur utilisateur', async () => {
  const state = await app.inject({ method: 'GET', url: '/api/reservations/invalide' });
  assert.equal(state.statusCode, 400);
  assert.equal(state.json().error.code, 'INVALID_INPUT');
  const checkout = await app.inject({ method: 'POST', url: '/api/reservations/invalide/checkout', payload: { scenario: 'success' } });
  assert.equal(checkout.statusCode, 400);
  assert.equal(checkout.json().error.code, 'INVALID_INPUT');
});
