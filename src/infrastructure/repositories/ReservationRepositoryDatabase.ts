import type { Pool } from 'pg';
import { Reservation } from '../../domain/entities/Reservation.js';
import type { NewReservation, ReservationRepositoryInterface } from '../../domain/interfaces/ReservationRepositoryInterface.js';
import type { ReservationStatus } from '../../domain/types.js';

interface ReservationRow {
  id: string;
  event_id: string;
  customer_ref: string;
  status: ReservationStatus;
  created_at: Date;
  expires_at: Date;
}

function toEntity(row: ReservationRow): Reservation {
  return new Reservation({
    id: row.id,
    eventId: row.event_id,
    customerRef: row.customer_ref,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  });
}

export class ReservationRepositoryDatabase implements ReservationRepositoryInterface {
  constructor(private readonly pool: Pool) {}

  async expirePending(): Promise<void> {
    await this.pool.query("UPDATE reservations SET status = 'EXPIRED' WHERE status = 'PENDING' AND expires_at <= now()");
  }

  async create(reservation: NewReservation): Promise<Reservation> {
    const result = await this.pool.query<ReservationRow>(
      'INSERT INTO reservations (id, event_id, customer_ref, status, expires_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [reservation.id, reservation.eventId, reservation.customerRef, 'PENDING', reservation.expiresAt],
    );
    return toEntity(result.rows[0]);
  }

  async findById(id: string): Promise<Reservation | null> {
    const result = await this.pool.query<ReservationRow>('SELECT * FROM reservations WHERE id = $1', [id]);
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async changeStatus(id: string, status: ReservationStatus): Promise<Reservation> {
    const result = await this.pool.query<ReservationRow>('UPDATE reservations SET status = $2 WHERE id = $1 RETURNING *', [id, status]);
    return toEntity(result.rows[0]);
  }
}
