import type { Event } from '../../../domain/entities/Event.js';
import type { EventRepositoryInterface } from '../../../domain/interfaces/EventRepositoryInterface.js';
import type { ReservationRepositoryInterface } from '../../../domain/interfaces/ReservationRepositoryInterface.js';

export class ListEventsUseCase {
  constructor(
    private readonly events: EventRepositoryInterface,
    private readonly reservations: ReservationRepositoryInterface,
  ) {}

  async execute(): Promise<Event[]> {
    await this.reservations.expirePending();
    return this.events.list();
  }
}
