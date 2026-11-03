import type { FastifyReply, FastifyRequest } from 'fastify';
import type { LoginUseCase, RegisterUseCase } from '../../application/usecases/index.js';
import { AUTH_COOKIE_NAME, cookieOptions } from '../../utility/authCookie.js';
import type { AuthConfig } from '../config.js';
import { parseCredentials } from '../validation/index.js';

export class UserController {
  constructor(
    private readonly registerUser: RegisterUseCase,
    private readonly loginUser: LoginUseCase,
    private readonly config: Pick<AuthConfig, 'tokenTtlMinutes' | 'cookieSecure'>,
  ) {}

  register = async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = parseCredentials(request.body);
    const { user, token } = await this.registerUser.execute(email, password);
    return reply.setCookie(AUTH_COOKIE_NAME, token, this.sessionCookie()).code(201).send({ user: user.toJSON() });
  };

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = parseCredentials(request.body);
    const { user, token } = await this.loginUser.execute(email, password);
    return reply.setCookie(AUTH_COOKIE_NAME, token, this.sessionCookie()).send({ user: user.toJSON() });
  };

  logout = async (_request: FastifyRequest, reply: FastifyReply) =>
    reply.clearCookie(AUTH_COOKIE_NAME, cookieOptions(this.config.cookieSecure)).code(204).send();

  me = async (request: FastifyRequest) => ({ user: request.user!.toJSON() });

  private sessionCookie() {
    return cookieOptions(this.config.cookieSecure, Math.round(this.config.tokenTtlMinutes * 60));
  }
}
