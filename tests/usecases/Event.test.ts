import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { makeEvent } from '../helpers/fakes.js';

describe('Event', () => {
  test('available = capacité - réservations actives', () => {
    assert.equal(makeEvent({ capacity: 10, activeReservations: 3 }).available, 7);
  });

  test('isCancelled reflète le statut', () => {
    assert.equal(makeEvent({ status: 'CANCELLED' }).isCancelled(), true);
    assert.equal(makeEvent({ status: 'OPEN' }).isCancelled(), false);
  });

  test('hasSeatsLeft est faux quand c’est complet', () => {
    assert.equal(makeEvent({ capacity: 2, activeReservations: 1 }).hasSeatsLeft(), true);
    assert.equal(makeEvent({ capacity: 2, activeReservations: 2 }).hasSeatsLeft(), false);
  });
});
