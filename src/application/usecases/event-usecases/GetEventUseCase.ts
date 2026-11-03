import type { Event } from '../../../domain/entities/Event.js';
import type { EventRepositoryInterface } from '../../../domain/interfaces/EventRepositoryInterface.js';
import type { ReservationRepositoryInterface } from '../../../domain/interfaces/ReservationRepositoryInterface.js';
import { httpError } from '../../../utility/httpError.js';

export class GetEventUseCase {
  constructor(
    private readonly events: EventRepositoryInterface,
    private readonly reservations: ReservationRepositoryInterface,
  ) {}

  async execute(id: string): Promise<Event> {
    await this.reservations.expirePending();
    const event = await this.events.findById(id);
    if (!event) throw httpError(404, 'EVENT_NOT_FOUND', 'Événement introuvable.');
    return event;
  }
}
