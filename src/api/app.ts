import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import type { Pool } from 'pg';
import {
  CheckoutReservationUseCase,
  GetCurrentUserUseCase,
  GetEventUseCase,
  GetReservationUseCase,
  ListEventsUseCase,
  LoginUseCase,
  RegisterUseCase,
  ReserveSeatUseCase,
} from '../application/usecases/index.js';
import { EventRepositoryDatabase } from '../infrastructure/repositories/EventRepositoryDatabase.js';
import { PaymentAttemptRepositoryDatabase } from '../infrastructure/repositories/PaymentAttemptRepositoryDatabase.js';
import { ReservationRepositoryDatabase } from '../infrastructure/repositories/ReservationRepositoryDatabase.js';
import { UserRepositoryDatabase } from '../infrastructure/repositories/UserRepositoryDatabase.js';
import { JoseTokenService } from '../infrastructure/services/JoseTokenService.js';
import { PaymentSimulatorService } from '../infrastructure/services/PaymentSimulatorService.js';
import { ScryptPasswordHasher } from '../infrastructure/services/ScryptPasswordHasher.js';
import type { AppConfig } from './config.js';
import { EventController } from './controllers/EventController.js';
import { HealthController } from './controllers/HealthController.js';
import { ReservationController } from './controllers/ReservationController.js';
import { UserController } from './controllers/UserController.js';
import { createAuthMiddleware, registerErrorHandler } from './middlewares/index.js';
import { registerRoutes } from './routes/index.js';

export type { AppConfig } from './config.js';

export function buildApp(pool: Pool, config: AppConfig) {
  const app = Fastify({ logger: true });

  const events = new EventRepositoryDatabase(pool);
  const reservations = new ReservationRepositoryDatabase(pool);
  const paymentAttempts = new PaymentAttemptRepositoryDatabase(pool);
  const users = new UserRepositoryDatabase(pool);
  const payment = new PaymentSimulatorService(config.paymentSlowMs);
  const hasher = new ScryptPasswordHasher();
  const tokens = new JoseTokenService(config.jwtSecret, config.tokenTtlMinutes);

  const getCurrentUser = new GetCurrentUserUseCase(users, tokens);

  void app.register(cookie);
  registerErrorHandler(app);
  registerRoutes(
    app,
    {
      health: new HealthController(async () => { await pool.query('SELECT 1'); }),
      events: new EventController(new ListEventsUseCase(events, reservations), new GetEventUseCase(events, reservations)),
      reservations: new ReservationController(
        new ReserveSeatUseCase(events, reservations, config),
        new GetReservationUseCase(reservations, paymentAttempts),
        new CheckoutReservationUseCase(reservations, paymentAttempts, payment),
      ),
      users: new UserController(new RegisterUseCase(users, hasher, tokens), new LoginUseCase(users, hasher, tokens), config),
    },
    createAuthMiddleware(getCurrentUser),
  );
  return app;
}
