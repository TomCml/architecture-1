import { PAYMENT_SCENARIOS, type PaymentScenario } from '../../domain/types.js';
import { httpError } from '../../utility/httpError.js';
import { asRecord, parseUuid, stringField } from './common.schema.js';

export function parseReservationId(params: { id: string }): string {
  return parseUuid(params.id, 'Identifiant de réservation invalide.');
}

export function parseCreateReservation(body: unknown): { eventId: string; customerRef: string } {
  const record = asRecord(body);
  return { eventId: stringField(record, 'eventId'), customerRef: stringField(record, 'customerRef') };
}

export function parseCheckoutScenario(body: unknown): PaymentScenario {
  const scenario = asRecord(body).scenario;
  if (typeof scenario !== 'string') return 'success';
  if (!(PAYMENT_SCENARIOS as readonly string[]).includes(scenario)) {
    throw httpError(400, 'INVALID_INPUT', 'Scénario de paiement invalide.');
  }
  return scenario as PaymentScenario;
}
