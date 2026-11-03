import type { FastifyReply, FastifyRequest } from 'fastify';
import type { GetCurrentUserUseCase } from '../../application/usecases/index.js';
import type { User } from '../../domain/entities/User.js';
import { AUTH_COOKIE_NAME } from '../../utility/authCookie.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

export function createAuthMiddleware(getCurrentUser: GetCurrentUserUseCase) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    request.user = await getCurrentUser.execute(request.cookies[AUTH_COOKIE_NAME]);
  };
}
