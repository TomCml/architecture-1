import type { ReservationStatus } from '../types.js';

export interface ReservationProps {
  id: string;
  eventId: string;
  customerRef: string;
  status: ReservationStatus;
  createdAt: Date;
  expiresAt: Date;
}

const MAX_CUSTOMER_REF_LENGTH = 80;

export class Reservation {
  constructor(public readonly props: ReservationProps) {}

  static isValidCustomerRef(customerRef: string): boolean {
    return customerRef.trim().length > 0 && customerRef.length <= MAX_CUSTOMER_REF_LENGTH;
  }

  get id() { return this.props.id; }
  get eventId() { return this.props.eventId; }
  get customerRef() { return this.props.customerRef; }
  get status() { return this.props.status; }
  get createdAt() { return this.props.createdAt; }
  get expiresAt() { return this.props.expiresAt; }

  isPending(): boolean {
    return this.props.status === 'PENDING';
  }

  isExpired(): boolean {
    return this.props.status === 'EXPIRED';
  }

  toJSON() {
    return {
      id: this.id,
      eventId: this.eventId,
      customerRef: this.customerRef,
      status: this.status,
      createdAt: this.createdAt.toISOString(),
      expiresAt: this.expiresAt.toISOString(),
    };
  }
}
