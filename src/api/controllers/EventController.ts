import type { FastifyRequest } from 'fastify';
import type { GetEventUseCase, ListEventsUseCase } from '../../application/usecases/index.js';
import { parseEventId } from '../validation/index.js';

export class EventController {
  constructor(
    private readonly listEvents: ListEventsUseCase,
    private readonly getEvent: GetEventUseCase,
  ) {}

  list = async () => ({ events: (await this.listEvents.execute()).map(event => event.toJSON()) });

  getById = async (request: FastifyRequest<{ Params: { id: string } }>) => ({
    event: (await this.getEvent.execute(parseEventId(request.params))).toJSON(),
  });
}
