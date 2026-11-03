import type { FastifyInstance } from 'fastify';
import type { EventController } from '../controllers/EventController.js';
import type { HealthController } from '../controllers/HealthController.js';
import type { ReservationController } from '../controllers/ReservationController.js';
import type { UserController } from '../controllers/UserController.js';
import type { createAuthMiddleware } from '../middlewares/index.js';
import { registerEventRoutes } from './EventRoutes.js';
import { registerHealthRoutes } from './HealthRoutes.js';
import { registerReservationRoutes } from './ReservationRoutes.js';
import { registerStaticRoutes } from './StaticRoutes.js';
import { registerUserRoutes } from './UserRoutes.js';

export interface Controllers {
  health: HealthController;
  events: EventController;
  reservations: ReservationController;
  users: UserController;
}

export function registerRoutes(
  app: FastifyInstance,
  controllers: Controllers,
  authenticate: ReturnType<typeof createAuthMiddleware>,
): void {
  registerHealthRoutes(app, controllers.health);
  registerEventRoutes(app, controllers.events);
  registerReservationRoutes(app, controllers.reservations);
  registerUserRoutes(app, controllers.users, authenticate);
  registerStaticRoutes(app);
}
