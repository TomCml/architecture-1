# Plan — Refactor to Clean Architecture (Tooly layout)

Branch: `clean-architecture` (from `ae159b6`, N-layer + auth).

## Goal

Reorganise the whole backend into the same Clean Architecture layout as `/home/tom/Documents/Code/Tooly/backend`:

```
api/            controllers, routes, middlewares, validation, app
application/    usecases/<feature>-usecases/*UseCase.ts + index.ts
domain/         entities/*.ts, interfaces/*Interface.ts
infrastructure/ database/, repositories/*RepositoryDatabase.ts, services/
utility/        httpError.ts, authCookie.ts, small helpers
tests/          usecases/*.test.ts (unit, fakes) + *.integration.test.ts + helpers/
```

**Dependency rule:** `domain` imports nothing outside `domain`. `application` imports `domain` and `utility` only (never `pg`, `fastify`, `jose`, `node:crypto` scrypt, or `infrastructure`). `infrastructure` implements `domain/interfaces`. `api` wires everything.

## What stays the same (hard constraints)

- **Observable HTTP contract is frozen:** same routes, methods, status codes, error codes, JSON shapes (`{ events }`, `{ event }`, `{ reservation }`, `{ reservation, paymentAttempt }`, `{ user }`, `{ error: { code, message } }`, `503 TECHNICAL_FAILURE`), same cookie (`access_token`, HttpOnly, SameSite=Strict, Path=/, Max-Age, Secure from config). Field names and ISO date strings unchanged.
- **Tech stack unchanged:** Fastify, `pg` (raw SQL, no ORM), `jose`, `node:crypto` scrypt, `@fastify/cookie`, `node:test` + `tsx`, ESM with `.js` import suffixes (`module: NodeNext`). Do **not** port Tooly's Express/Prisma/Jest/bcrypt.
- **Behaviour unchanged**, including known limitations: no transaction around reserve (the `test:challenge` concurrency test must still **fail** the same way), lazy expiry before each read/command, `reservationHoldMs` pause, payment simulator scenarios.
- `public/` front-end: untouched.
- Existing integration test bodies: unchanged (only file names, import paths and the `buildApp` import may change).

## Deliberate deviations from Tooly (keep, and mention in README)

1. **Code stays under `src/`** (`src/api`, `src/application`, …) because this repo also holds `public/`, `scripts/`, Docker files at the root.
2. **Composition root instead of module-level singletons.** Tooly controllers do `const repo = new XRepositoryDatabase()` at module scope. Here `buildApp(pool, config)` must keep receiving the pool and config (tests build the app with their own config), so controllers are **classes receiving their use cases in the constructor**, and all wiring happens in `src/api/app.ts`.
3. **Domain services behind interfaces.** Tooly calls `utility/password.utility.ts` directly from use cases. Here password hashing, tokens and payment go through `domain/interfaces` (like Tooly's `TokenStoreInterface` / `GeocodingServiceInterface`), so use cases are unit-testable with fakes.
4. **Error helper keeps a code.** `utility/httpError.ts` mirrors Tooly but takes a code: `httpError(statusCode, code, message)` returns an `Error` with `statusCode` and `code`. The error middleware formats it into the existing `{ error: { code, message } }`.

## Target tree

```
src/
  api/
    app.ts                         buildApp(pool, config): wiring + plugin + error handler + routes
    server.ts                      env → config, Pool, listen, graceful stop (moved from src/server.ts)
    config.ts                      AppConfig type (TicketingConfig & AuthConfig fields)
    controllers/
      EventController.ts           list, getById
      ReservationController.ts     create, getById, checkout
      UserController.ts            register, login, logout, me
      HealthController.ts          health (SELECT 1 via a HealthCheck function/pool passed in)
    middlewares/
      auth.middleware.ts           Fastify preHandler: reads cookie, runs GetCurrentUserUseCase, sets request.user; 401 UNAUTHENTICATED
      error.middleware.ts          setErrorHandler logic (httpError → status/code, validation → 400 INVALID_INPUT, else 503)
      index.ts
    routes/
      EventRoutes.ts               GET /api/events, GET /api/events/:id
      ReservationRoutes.ts         POST /api/reservations, GET /api/reservations/:id, POST /api/reservations/:id/checkout
      UserRoutes.ts                POST /api/auth/register|login|logout, GET /api/auth/me (uses auth.middleware)
      HealthRoutes.ts              GET /health
      StaticRoutes.ts              /, /app.css, /app.js
      index.ts                     registerRoutes(app, controllers)
    validation/
      common.schema.ts, event.schema.ts, reservation.schema.ts, user.schema.ts, index.ts
                                   HTTP-shape parsing only (body fields are strings, reservation id is a UUID,
                                   scenario ∈ success|failure|slow). Plain TS functions returning typed input or
                                   throwing httpError(400, 'INVALID_INPUT', …). No new dependency.
                                   Business rules (customerRef length, email format, password length) live in domain/application.
  application/
    usecases/
      event-usecases/ListEventsUseCase.ts, GetEventUseCase.ts
      reservation-usecases/ReserveSeatUseCase.ts, GetReservationUseCase.ts, CheckoutReservationUseCase.ts
      user-usecases/RegisterUseCase.ts, LoginUseCase.ts, GetCurrentUserUseCase.ts
      index.ts                     export * from each
  domain/
    entities/
      Event.ts                     props + getters; available (capacity − activeReservations), isCancelled(), hasSeatsLeft()
      Reservation.ts               props + getters; isPending(), isExpired(); validation of customerRef (non-empty, ≤ 80)
      PaymentAttempt.ts
      User.ts                      email normalisation/validation helpers as static methods; no hash exposed outside
    interfaces/
      EventRepositoryInterface.ts
      ReservationRepositoryInterface.ts   create, findById, changeStatus, expirePending
      PaymentAttemptRepositoryInterface.ts
      UserRepositoryInterface.ts          create, findCredentialsByEmail, findById
      PaymentGatewayInterface.ts          run(scenario) → PaymentStatus
      PasswordHasherInterface.ts          hash, verify
      TokenServiceInterface.ts            sign(userId), verify(token) → userId | null
      ClockInterface.ts (optional)        only if needed to unit test expiry; otherwise skip
    types.ts                       status unions (EventStatus, ReservationStatus, PaymentStatus, PaymentScenario)
  infrastructure/
    database/
      db.ts                        createPool(connectionString)
      migrate.ts                   moved from src/migrate.ts; reads SQL from infrastructure/database/migrations
      migrations/001_init.sql, 002_users.sql     (moved from db/migrations)
      seeds/001_demo.sql                           (moved from db/seeds)
    repositories/
      EventRepositoryDatabase.ts, ReservationRepositoryDatabase.ts,
      PaymentAttemptRepositoryDatabase.ts, UserRepositoryDatabase.ts
                                   implement domain interfaces, take Pool in constructor, map rows → entities
                                   (23505 on users → httpError(409, 'EMAIL_TAKEN', …) as today)
    services/
      PaymentSimulatorService.ts   implements PaymentGatewayInterface
      ScryptPasswordHasher.ts      implements PasswordHasherInterface (current PasswordHasher code)
      JoseTokenService.ts          implements TokenServiceInterface (current TokenIssuer code)
  utility/
    httpError.ts
    authCookie.ts                  AUTH_COOKIE_NAME = 'access_token', cookieOptions(secure, maxAgeSeconds)
```

Delete the old files once moved: `src/app.ts`, `src/server.ts`, `src/migrate.ts`, `src/errors.ts`, `src/types.ts`, `src/services/`, `src/repositories/`, `src/integrations/`, `db/`.

### Mapping of current logic → use cases

| Current (`TicketingService` / `AuthService`) | New use case | Notes |
|---|---|---|
| `listEvents` | `ListEventsUseCase` | calls `reservations.expirePending()` first, as today |
| `getEvent` | `GetEventUseCase` | 404 `EVENT_NOT_FOUND` |
| `reserve` | `ReserveSeatUseCase` | same order of checks: input (400) → expirePending → find (404) → `event.isCancelled()` (409 `EVENT_CANCELLED`) → `!event.hasSeatsLeft()` (409 `SOLD_OUT`) → `sleep(reservationHoldMs)` → create with `expiresAt = now + ttl` |
| `getReservation` | `GetReservationUseCase` | returns reservation + payment attempts |
| `checkout` | `CheckoutReservationUseCase` | 410 `RESERVATION_EXPIRED`, 409 `RESERVATION_CLOSED`, then attempt + gateway + status transitions |
| `AuthService.register/login/getCurrentUser` | `RegisterUseCase`, `LoginUseCase`, `GetCurrentUserUseCase` | same errors, same dummy-hash timing protection |

Mapping entities → JSON stays in the controllers (or a small `toJSON()`/presenter per entity) so the response shapes are byte-for-byte what the current tests expect.

## Build, Docker, scripts

- `tsconfig.json`: unchanged (`rootDir: src`).
- `package.json` scripts: `start` → `node dist/api/server.js`, `dev` → `tsx watch src/api/server.ts`, `migrate` → `tsx src/infrastructure/database/migrate.ts`, `test` → `tsx --test --test-concurrency=1 "tests/**/*.test.ts"` (check the glob works with the Node version in the image; otherwise list files explicitly).
- `Dockerfile`: stop copying `db/`; the runtime stage must contain the SQL files (copy `src/infrastructure/database/migrations` and `seeds` from the build stage to the same relative location `migrate.js` resolves, e.g. resolve paths from `process.cwd()` + `src/infrastructure/database/...`, or copy them next to `dist/infrastructure/database/`). Pick one, make it work in both `tsx` (dev/test) and `node dist` (runtime).
- `compose.yaml`: `migrate` and `test` commands → `node dist/infrastructure/database/migrate.js`. App command comes from the Dockerfile `CMD` → `node dist/api/server.js`.
- `.github/workflows/ci.yml`: should keep working unchanged; verify.

## Tests

- Rename `tests/api.test.ts` → `tests/ticketing.integration.test.ts`, `tests/auth.test.ts` → `tests/auth.integration.test.ts`; only change imports (`../src/api/app.js`). Bodies untouched.
- `tests/concurrency.challenge.ts`: only fix the import. It must still fail (it is the deliberate challenge).
- **New unit tests** in `tests/usecases/` (`node:test`, `assert/strict`, in-memory fakes implementing the domain interfaces — no PostgreSQL, no Fastify), mirroring Tooly's `tests/usecases/*.test.ts` style:
  - `ReserveSeatUseCase.test.ts`: invalid input → 400; unknown event → 404; cancelled → 409 `EVENT_CANCELLED` and `create` not called; sold out → 409 `SOLD_OUT`; cancelled **and** sold out → `EVENT_CANCELLED`; success → create called with trimmed customerRef and expiresAt ≈ now + ttl.
  - `CheckoutReservationUseCase.test.ts`: expired → 410; confirmed → 409 `RESERVATION_CLOSED`; success/failure/slow transitions.
  - `LoginUseCase.test.ts`: unknown email and wrong password → same 401 `INVALID_CREDENTIALS`; success returns token.
  - `RegisterUseCase.test.ts`: invalid email/password → 400; duplicate → 409; email normalised.
  - `Event.test.ts` (entity): `available`, `isCancelled`, `hasSeatsLeft`.

## Docs

- `README.md`: replace the "Structure initiale" section with the new tree and a short paragraph on the dependency rule and the 4 deviations above. Update commands that reference old paths.
- Leave `docs/architecture-initiale.md`, `docs/tp2-reponses.md`, older plans untouched (historical).

## Acceptance

1. `docker compose --profile test run --build --rm test` → all tests pass: the 17 existing integration tests + new unit tests, 0 failures.
2. `docker compose --profile test run --rm test sh -c 'node dist/infrastructure/database/migrate.js && npm run test:challenge'` → still fails on the capacity invariant (unchanged behaviour).
3. `docker compose up --build -d` then `curl` smoke test: `/health` 200, `/api/events` 200, reserve 201, checkout 200, auth register/login/me/logout as before, `/` serves HTML.
4. `grep -rE "from '(pg|fastify|jose|@fastify/cookie)'|node:crypto|infrastructure/|api/" src/domain src/application` → nothing (except `node:crypto` `randomUUID` is acceptable in application if needed; prefer passing ids via an `IdGenerator` interface only if trivial — otherwise note it).
5. No commit; leave changes in the working tree on branch `clean-architecture`.
