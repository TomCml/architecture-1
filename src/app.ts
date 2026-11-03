import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import type { Pool } from 'pg';
import { AppError } from './errors.js';
import { PasswordHasher } from './integrations/PasswordHasher.js';
import { PaymentSimulator } from './integrations/PaymentSimulator.js';
import { TokenIssuer } from './integrations/TokenIssuer.js';
import { EventRepository } from './repositories/EventRepository.js';
import { PaymentAttemptRepository } from './repositories/PaymentAttemptRepository.js';
import { ReservationRepository } from './repositories/ReservationRepository.js';
import { UserRepository } from './repositories/UserRepository.js';
import { AuthService, type AuthConfig } from './services/AuthService.js';
import { TicketingService, type TicketingConfig } from './services/TicketingService.js';
import type { PaymentScenario } from './types.js';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export type AppConfig = TicketingConfig & AuthConfig;

const AUTH_COOKIE = 'access_token';

export function buildApp(pool: Pool, config: AppConfig) {
  const app = Fastify({ logger: true });
  const service = new TicketingService(
    new EventRepository(pool),
    new ReservationRepository(pool),
    new PaymentAttemptRepository(pool),
    new PaymentSimulator(config.paymentSlowMs),
    config,
  );
  const auth = new AuthService(
    new UserRepository(pool),
    new PasswordHasher(),
    new TokenIssuer(config.jwtSecret, config.tokenTtlMinutes),
  );
  void app.register(cookie);

  const cookieOptions = { httpOnly: true, sameSite: 'strict', path: '/', secure: config.cookieSecure } as const;

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
    }
    app.log.error(error);
    return reply.code(503).send({ error: { code: 'TECHNICAL_FAILURE', message: 'Service momentanément indisponible.' } });
  });

  app.get('/health', async (_request, reply) => {
    await pool.query('SELECT 1');
    return reply.send({ status: 'ok' });
  });
  app.get('/api/events', async () => ({ events: await service.listEvents() }));
  app.get<{ Params: { id: string } }>('/api/events/:id', async request => ({ event: await service.getEvent(request.params.id) }));
  app.post('/api/reservations', async (request, reply) => {
    const body = asRecord(request.body);
    const eventId = typeof body.eventId === 'string' ? body.eventId : '';
    const customerRef = typeof body.customerRef === 'string' ? body.customerRef : '';
    return reply.code(201).send({ reservation: await service.reserve(eventId, customerRef) });
  });
  app.get<{ Params: { id: string } }>('/api/reservations/:id', async request => ({ reservation: await service.getReservation(request.params.id) }));
  app.post<{ Params: { id: string } }>('/api/reservations/:id/checkout', async request => {
    const body = asRecord(request.body);
    const scenario = typeof body.scenario === 'string' ? body.scenario as PaymentScenario : 'success';
    return service.checkout(request.params.id, scenario);
  });

  app.post('/api/auth/register', async (request, reply) => {
    const body = asRecord(request.body);
    const email = typeof body.email === 'string' ? body.email : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const { user, token } = await auth.register(email, password);
    return reply
      .setCookie(AUTH_COOKIE, token, { ...cookieOptions, maxAge: Math.round(config.tokenTtlMinutes * 60) })
      .code(201)
      .send({ user });
  });
  app.post('/api/auth/login', async (request, reply) => {
    const body = asRecord(request.body);
    const email = typeof body.email === 'string' ? body.email : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const { user, token } = await auth.login(email, password);
    return reply
      .setCookie(AUTH_COOKIE, token, { ...cookieOptions, maxAge: Math.round(config.tokenTtlMinutes * 60) })
      .send({ user });
  });
  app.post('/api/auth/logout', async (_request, reply) => reply.clearCookie(AUTH_COOKIE, cookieOptions).code(204).send());
  app.get('/api/auth/me', async request => ({ user: await auth.getCurrentUser(request.cookies[AUTH_COOKIE]) }));

  for (const [route, file, type] of [
    ['/', 'index.html', 'text/html; charset=utf-8'],
    ['/app.css', 'app.css', 'text/css; charset=utf-8'],
    ['/app.js', 'app.js', 'text/javascript; charset=utf-8'],
  ]) {
    app.get(route, async (_request, reply) => {
      const body = await readFile(join(process.cwd(), 'public', file));
      return reply.type(type).send(body);
    });
  }
  return app;
}
