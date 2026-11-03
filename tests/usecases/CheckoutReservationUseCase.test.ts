import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CheckoutReservationUseCase } from '../../src/application/usecases/index.js';
import {
  FakePaymentAttemptRepository,
  FakePaymentGateway,
  FakeReservationRepository,
  makeReservation,
  rejection,
} from '../helpers/fakes.js';

function build(status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'EXPIRED' | null) {
  const reservations = new FakeReservationRepository(status ? makeReservation({ status }) : null);
  const attempts = new FakePaymentAttemptRepository();
  return { attempts, useCase: new CheckoutReservationUseCase(reservations, attempts, new FakePaymentGateway()) };
}

describe('CheckoutReservationUseCase', () => {
  test('réservation inconnue : 404', async () => {
    const error = await rejection(build(null).useCase.execute('res-1', 'success'));
    assert.equal(error.statusCode, 404);
  });

  test('réservation expirée : 410 sans tentative', async () => {
    const { useCase, attempts } = build('EXPIRED');
    const error = await rejection(useCase.execute('res-1', 'success'));
    assert.equal(error.statusCode, 410);
    assert.equal(error.code, 'RESERVATION_EXPIRED');
    assert.equal(attempts.attempts.length, 0);
  });

  test('réservation confirmée : 409 RESERVATION_CLOSED', async () => {
    const error = await rejection(build('CONFIRMED').useCase.execute('res-1', 'success'));
    assert.equal(error.statusCode, 409);
    assert.equal(error.code, 'RESERVATION_CLOSED');
  });

  test('success : réservation CONFIRMED, tentative SUCCEEDED', async () => {
    const result = await build('PENDING').useCase.execute('res-1', 'success');
    assert.equal(result.reservation.status, 'CONFIRMED');
    assert.equal(result.paymentAttempt.status, 'SUCCEEDED');
  });

  test('failure : réservation FAILED, tentative FAILED', async () => {
    const result = await build('PENDING').useCase.execute('res-1', 'failure');
    assert.equal(result.reservation.status, 'FAILED');
    assert.equal(result.paymentAttempt.status, 'FAILED');
  });

  test('slow : réservation et tentative restent PENDING', async () => {
    const result = await build('PENDING').useCase.execute('res-1', 'slow');
    assert.equal(result.reservation.status, 'PENDING');
    assert.equal(result.paymentAttempt.status, 'PENDING');
  });
});
