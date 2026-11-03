import type { Reservation } from '../entities/Reservation.js';
import type { ReservationStatus } from '../types.js';

export interface NewReservation {
  id: string;
  eventId: string;
  customerRef: string;
  expiresAt: Date;
}

export interface ReservationRepositoryInterface {
  expirePending(): Promise<void>;
  create(reservation: NewReservation): Promise<Reservation>;
  findById(id: string): Promise<Reservation | null>;
  changeStatus(id: string, status: ReservationStatus): Promise<Reservation>;
}
