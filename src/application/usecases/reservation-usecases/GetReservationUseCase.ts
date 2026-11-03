import type { PaymentAttempt } from '../../../domain/entities/PaymentAttempt.js';
import type { Reservation } from '../../../domain/entities/Reservation.js';
import type { PaymentAttemptRepositoryInterface } from '../../../domain/interfaces/PaymentAttemptRepositoryInterface.js';
import type { ReservationRepositoryInterface } from '../../../domain/interfaces/ReservationRepositoryInterface.js';
import { httpError } from '../../../utility/httpError.js';

export interface ReservationDetails {
  reservation: Reservation;
  paymentAttempts: PaymentAttempt[];
}

export class GetReservationUseCase {
  constructor(
    private readonly reservations: ReservationRepositoryInterface,
    private readonly paymentAttempts: PaymentAttemptRepositoryInterface,
  ) {}

  async execute(id: string): Promise<ReservationDetails> {
    await this.reservations.expirePending();
    const reservation = await this.reservations.findById(id);
    if (!reservation) throw httpError(404, 'RESERVATION_NOT_FOUND', 'Réservation introuvable.');
    return { reservation, paymentAttempts: await this.paymentAttempts.listForReservation(id) };
  }
}
