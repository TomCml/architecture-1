import type { FastifyInstance } from 'fastify';
import type { ReservationController } from '../controllers/ReservationController.js';

export function registerReservationRoutes(app: FastifyInstance, controller: ReservationController): void {
  app.post('/api/reservations', controller.create);
  app.get<{ Params: { id: string } }>('/api/reservations/:id', controller.getById);
  app.post<{ Params: { id: string } }>('/api/reservations/:id/checkout', controller.checkout);
}
