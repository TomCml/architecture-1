import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ReserveSeatUseCase } from '../../src/application/usecases/index.js';
import { FakeEventRepository, FakeReservationRepository, makeEvent, rejection } from '../helpers/fakes.js';

const config = { reservationTtlMinutes: 15, reservationHoldMs: 0 };

function build(event = makeEvent()) {
  const events = new FakeEventRepository(event);
  const reservations = new FakeReservationRepository();
  return { events, reservations, useCase: new ReserveSeatUseCase(events, reservations, config) };
}

describe('ReserveSeatUseCase', () => {
  test('refuse une entrée invalide avec 400', async () => {
    const { useCase, reservations } = build();
    for (const input of [{ eventId: '', customerRef: 'c' }, { eventId: 'evt-1', customerRef: '  ' }, { eventId: 'evt-1', customerRef: 'x'.repeat(81) }]) {
      const error = await rejection(useCase.execute(input));
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, 'INVALID_INPUT');
    }
    assert.equal(reservations.created.length, 0);
  });

  test('événement inconnu : 404', async () => {
    const { useCase, events } = build();
    events.event = null;
    const error = await rejection(useCase.execute({ eventId: 'x', customerRef: 'c' }));
    assert.equal(error.statusCode, 404);
    assert.equal(error.code, 'EVENT_NOT_FOUND');
  });

  test('événement annulé : 409 EVENT_CANCELLED sans création', async () => {
    const { useCase, reservations } = build(makeEvent({ status: 'CANCELLED' }));
    const error = await rejection(useCase.execute({ eventId: 'evt-1', customerRef: 'c' }));
    assert.equal(error.statusCode, 409);
    assert.equal(error.code, 'EVENT_CANCELLED');
    assert.equal(reservations.created.length, 0);
  });

  test('complet : 409 SOLD_OUT', async () => {
    const { useCase, reservations } = build(makeEvent({ capacity: 1, activeReservations: 1 }));
    const error = await rejection(useCase.execute({ eventId: 'evt-1', customerRef: 'c' }));
    assert.equal(error.statusCode, 409);
    assert.equal(error.code, 'SOLD_OUT');
    assert.equal(reservations.created.length, 0);
  });

  test('annulé et complet : EVENT_CANCELLED prioritaire', async () => {
    const { useCase } = build(makeEvent({ status: 'CANCELLED', capacity: 1, activeReservations: 1 }));
    const error = await rejection(useCase.execute({ eventId: 'evt-1', customerRef: 'c' }));
    assert.equal(error.code, 'EVENT_CANCELLED');
  });

  test('succès : crée avec customerRef nettoyé et expiration à now + ttl', async () => {
    const { useCase, reservations } = build();
    const before = Date.now();
    await useCase.execute({ eventId: 'evt-1', customerRef: '  client-a  ' });
    const after = Date.now();
    assert.equal(reservations.expireCalls, 1);
    assert.equal(reservations.created.length, 1);
    const [created] = reservations.created;
    assert.equal(created.customerRef, 'client-a');
    assert.equal(created.eventId, 'evt-1');
    const expires = created.expiresAt.getTime();
    assert.ok(expires >= before + 15 * 60_000 && expires <= after + 15 * 60_000);
  });
});
