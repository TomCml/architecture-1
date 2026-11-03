import type { PaymentScenario, PaymentStatus } from '../types.js';

export interface PaymentAttemptProps {
  id: string;
  reservationId: string;
  scenario: PaymentScenario;
  status: PaymentStatus;
  createdAt: Date;
}

export class PaymentAttempt {
  constructor(public readonly props: PaymentAttemptProps) {}

  get id() { return this.props.id; }
  get reservationId() { return this.props.reservationId; }
  get scenario() { return this.props.scenario; }
  get status() { return this.props.status; }
  get createdAt() { return this.props.createdAt; }

  toJSON() {
    return {
      id: this.id,
      reservationId: this.reservationId,
      scenario: this.scenario,
      status: this.status,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
