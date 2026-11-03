import type { FastifyInstance } from 'fastify';
import type { HealthController } from '../controllers/HealthController.js';

export function registerHealthRoutes(app: FastifyInstance, controller: HealthController): void {
  app.get('/health', controller.health);
}
