import { setTimeout as sleep } from 'node:timers/promises';
import { Reservation } from '../../../domain/entities/Reservation.js';
import type { EventRepositoryInterface } from '../../../domain/interfaces/EventRepositoryInterface.js';
import type { ReservationRepositoryInterface } from '../../../domain/interfaces/ReservationRepositoryInterface.js';
import { httpError } from '../../../utility/httpError.js';
import { newId } from '../../../utility/id.js';

export interface ReserveSeatInput {
  eventId: string;
  customerRef: string;
}

export interface ReserveSeatConfig {
  reservationTtlMinutes: number;
  reservationHoldMs: number;
}

export class ReserveSeatUseCase {
  constructor(
    private readonly events: EventRepositoryInterface,
    private readonly reservations: ReservationRepositoryInterface,
    private readonly config: ReserveSeatConfig,
  ) {}

  async execute(input: ReserveSeatInput): Promise<Reservation> {
    if (!input.eventId.trim() || !Reservation.isValidCustomerRef(input.customerRef)) {
      throw httpError(400, 'INVALID_INPUT', 'Indiquez un événement et un identifiant client fictif.');
    }
    await this.reservations.expirePending();
    const event = await this.events.findById(input.eventId);
    if (!event) throw httpError(404, 'EVENT_NOT_FOUND', 'Événement introuvable.');
    if (event.isCancelled()) throw httpError(409, 'EVENT_CANCELLED', 'Cet événement est annulé.');
    if (!event.hasSeatsLeft()) throw httpError(409, 'SOLD_OUT', 'Il ne reste plus de place.');
    if (this.config.reservationHoldMs > 0) await sleep(this.config.reservationHoldMs);
    const expiresAt = new Date(Date.now() + this.config.reservationTtlMinutes * 60_000);
    return this.reservations.create({
      id: newId(),
      eventId: input.eventId,
      customerRef: input.customerRef.trim(),
      expiresAt,
    });
  }
}
