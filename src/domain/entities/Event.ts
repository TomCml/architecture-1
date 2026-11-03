import type { EventStatus } from '../types.js';

export interface EventProps {
  id: string;
  title: string;
  venue: string;
  startsAt: Date;
  capacity: number;
  activeReservations: number;
  status: EventStatus;
}

export class Event {
  constructor(public readonly props: EventProps) {}

  get id() { return this.props.id; }
  get title() { return this.props.title; }
  get venue() { return this.props.venue; }
  get startsAt() { return this.props.startsAt; }
  get capacity() { return this.props.capacity; }
  get activeReservations() { return this.props.activeReservations; }
  get status() { return this.props.status; }
  get available() { return this.props.capacity - this.props.activeReservations; }

  isCancelled(): boolean {
    return this.props.status === 'CANCELLED';
  }

  hasSeatsLeft(): boolean {
    return this.available > 0;
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      venue: this.venue,
      startsAt: this.startsAt.toISOString(),
      capacity: this.capacity,
      available: this.available,
      status: this.status,
    };
  }
}
