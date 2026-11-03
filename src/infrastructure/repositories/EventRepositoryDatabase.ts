import type { Pool } from 'pg';
import { Event } from '../../domain/entities/Event.js';
import type { EventRepositoryInterface } from '../../domain/interfaces/EventRepositoryInterface.js';
import type { EventStatus } from '../../domain/types.js';

interface EventRow {
  id: string;
  title: string;
  venue: string;
  starts_at: Date;
  capacity: number;
  active_reservations: number;
  status: EventStatus;
}

const activitySql = `
  SELECT e.id, e.title, e.venue, e.starts_at, e.capacity, e.status,
         (
           SELECT count(*)::int FROM reservations r
           WHERE r.event_id = e.id
             AND (r.status = 'CONFIRMED' OR (r.status = 'PENDING' AND r.expires_at > now()))
         ) AS active_reservations
  FROM events e`;

function toEntity(row: EventRow): Event {
  return new Event({
    id: row.id,
    title: row.title,
    venue: row.venue,
    startsAt: row.starts_at,
    capacity: row.capacity,
    activeReservations: row.active_reservations,
    status: row.status,
  });
}

export class EventRepositoryDatabase implements EventRepositoryInterface {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<Event[]> {
    const result = await this.pool.query<EventRow>(`${activitySql} ORDER BY e.starts_at, e.id`);
    return result.rows.map(toEntity);
  }

  async findById(id: string): Promise<Event | null> {
    const result = await this.pool.query<EventRow>(`${activitySql} WHERE e.id = $1`, [id]);
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }
}
