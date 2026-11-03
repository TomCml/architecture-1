import { Pool } from 'pg';
import { buildApp } from './app.js';

function numberFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const jwtSecret = process.env.JWT_SECRET ?? '';
if (jwtSecret.length < 32) {
  console.error('JWT_SECRET est obligatoire et doit contenir au moins 32 caractères.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = buildApp(pool, {
  reservationTtlMinutes: numberFromEnv('RESERVATION_TTL_MINUTES', 15),
  paymentSlowMs: numberFromEnv('PAYMENT_SLOW_MS', 2000),
  reservationHoldMs: numberFromEnv('LAB_RESERVATION_PAUSE_MS', 75),
  jwtSecret,
  tokenTtlMinutes: numberFromEnv('AUTH_TOKEN_TTL_MINUTES', 60),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
});

async function stop() {
  await app.close();
  await pool.end();
}
process.once('SIGINT', () => { void stop(); });
process.once('SIGTERM', () => { void stop(); });

app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 3000) }).catch(async error => {
  app.log.error(error);
  await stop();
  process.exitCode = 1;
});
