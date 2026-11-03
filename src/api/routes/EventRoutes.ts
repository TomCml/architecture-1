import type { FastifyInstance } from 'fastify';
import type { EventController } from '../controllers/EventController.js';

export function registerEventRoutes(app: FastifyInstance, controller: EventController): void {
  app.get('/api/events', controller.list);
  app.get<{ Params: { id: string } }>('/api/events/:id', controller.getById);
}
