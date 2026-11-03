import type { PaymentAttempt } from '../../../domain/entities/PaymentAttempt.js';
import type { Reservation } from '../../../domain/entities/Reservation.js';
import type { PaymentAttemptRepositoryInterface } from '../../../domain/interfaces/PaymentAttemptRepositoryInterface.js';
import type { PaymentGatewayInterface } from '../../../domain/interfaces/PaymentGatewayInterface.js';
import type { ReservationRepositoryInterface } from '../../../domain/interfaces/ReservationRepositoryInterface.js';
import type { PaymentScenario } from '../../../domain/types.js';
import { httpError } from '../../../utility/httpError.js';
import { newId } from '../../../utility/id.js';

export interface CheckoutResult {
  reservation: Reservation;
  paymentAttempt: PaymentAttempt;
}

export class CheckoutReservationUseCase {
  constructor(
    private readonly reservations: ReservationRepositoryInterface,
    private readonly paymentAttempts: PaymentAttemptRepositoryInterface,
    private readonly payment: PaymentGatewayInterface,
  ) {}

  async execute(id: string, scenario: PaymentScenario): Promise<CheckoutResult> {
    await this.reservations.expirePending();
    const reservation = await this.reservations.findById(id);
    if (!reservation) throw httpError(404, 'RESERVATION_NOT_FOUND', 'Réservation introuvable.');
    if (reservation.isExpired()) throw httpError(410, 'RESERVATION_EXPIRED', 'La réservation a expiré.');
    if (!reservation.isPending()) throw httpError(409, 'RESERVATION_CLOSED', 'La réservation ne peut plus être payée.');

    let attempt = await this.paymentAttempts.create(newId(), id, scenario);
    const result = await this.payment.run(scenario);
    if (result === 'SUCCEEDED') {
      attempt = await this.paymentAttempts.changeStatus(attempt.id, 'SUCCEEDED');
      return { reservation: await this.reservations.changeStatus(id, 'CONFIRMED'), paymentAttempt: attempt };
    }
    if (result === 'FAILED') {
      attempt = await this.paymentAttempts.changeStatus(attempt.id, 'FAILED');
      return { reservation: await this.reservations.changeStatus(id, 'FAILED'), paymentAttempt: attempt };
    }
    return { reservation, paymentAttempt: attempt };
  }
}
