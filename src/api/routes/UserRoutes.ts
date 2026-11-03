import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { UserController } from '../controllers/UserController.js';

type AuthMiddleware = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export function registerUserRoutes(app: FastifyInstance, controller: UserController, authenticate: AuthMiddleware): void {
  app.post('/api/auth/register', controller.register);
  app.post('/api/auth/login', controller.login);
  app.post('/api/auth/logout', controller.logout);
  app.get('/api/auth/me', { preHandler: authenticate }, controller.me);
}
