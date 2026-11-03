import type { PaymentAttempt } from '../entities/PaymentAttempt.js';
import type { PaymentScenario, PaymentStatus } from '../types.js';

export interface PaymentAttemptRepositoryInterface {
  create(id: string, reservationId: string, scenario: PaymentScenario): Promise<PaymentAttempt>;
  changeStatus(id: string, status: PaymentStatus): Promise<PaymentAttempt>;
  listForReservation(reservationId: string): Promise<PaymentAttempt[]>;
}
