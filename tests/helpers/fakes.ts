import { Event, type EventProps } from '../../src/domain/entities/Event.js';
import { PaymentAttempt } from '../../src/domain/entities/PaymentAttempt.js';
import { Reservation, type ReservationProps } from '../../src/domain/entities/Reservation.js';
import { User } from '../../src/domain/entities/User.js';
import type { EventRepositoryInterface } from '../../src/domain/interfaces/EventRepositoryInterface.js';
import type { PasswordHasherInterface } from '../../src/domain/interfaces/PasswordHasherInterface.js';
import type { PaymentAttemptRepositoryInterface } from '../../src/domain/interfaces/PaymentAttemptRepositoryInterface.js';
import type { PaymentGatewayInterface } from '../../src/domain/interfaces/PaymentGatewayInterface.js';
import type {
  NewReservation,
  ReservationRepositoryInterface,
} from '../../src/domain/interfaces/ReservationRepositoryInterface.js';
import type { TokenServiceInterface } from '../../src/domain/interfaces/TokenServiceInterface.js';
import type { UserCredentials, UserRepositoryInterface } from '../../src/domain/interfaces/UserRepositoryInterface.js';
import type { PaymentScenario, PaymentStatus, ReservationStatus } from '../../src/domain/types.js';
import { httpError } from '../../src/utility/httpError.js';

export function makeEvent(overrides: Partial<EventProps> = {}): Event {
  return new Event({
    id: 'evt-1',
    title: 'Concert',
    venue: 'Salle',
    startsAt: new Date('2027-01-01T20:00:00Z'),
    capacity: 10,
    activeReservations: 0,
    status: 'OPEN',
    ...overrides,
  });
}

export function makeReservation(overrides: Partial<ReservationProps> = {}): Reservation {
  return new Reservation({
    id: 'res-1',
    eventId: 'evt-1',
    customerRef: 'client',
    status: 'PENDING',
    createdAt: new Date('2027-01-01T10:00:00Z'),
    expiresAt: new Date('2027-01-01T10:15:00Z'),
    ...overrides,
  });
}

export class FakeEventRepository implements EventRepositoryInterface {
  constructor(public event: Event | null = null) {}
  async list() { return this.event ? [this.event] : []; }
  async findById() { return this.event; }
}

export class FakeReservationRepository implements ReservationRepositoryInterface {
  created: NewReservation[] = [];
  expireCalls = 0;
  constructor(public reservation: Reservation | null = null) {}
  async expirePending() { this.expireCalls += 1; }
  async create(input: NewReservation) {
    this.created.push(input);
    return makeReservation({ id: input.id, eventId: input.eventId, customerRef: input.customerRef, expiresAt: input.expiresAt });
  }
  async findById() { return this.reservation; }
  async changeStatus(id: string, status: ReservationStatus) {
    return makeReservation({ ...(this.reservation?.props ?? {}), id, status });
  }
}

export class FakePaymentAttemptRepository implements PaymentAttemptRepositoryInterface {
  attempts: PaymentAttempt[] = [];
  async create(id: string, reservationId: string, scenario: PaymentScenario) {
    const attempt = new PaymentAttempt({ id, reservationId, scenario, status: 'PENDING', createdAt: new Date() });
    this.attempts.push(attempt);
    return attempt;
  }
  async changeStatus(id: string, status: PaymentStatus) {
    const current = this.attempts.find(attempt => attempt.id === id)!;
    return new PaymentAttempt({ ...current.props, status });
  }
  async listForReservation(reservationId: string) {
    return this.attempts.filter(attempt => attempt.reservationId === reservationId);
  }
}

export class FakePaymentGateway implements PaymentGatewayInterface {
  async run(scenario: PaymentScenario): Promise<PaymentStatus> {
    if (scenario === 'slow') return 'PENDING';
    return scenario === 'success' ? 'SUCCEEDED' : 'FAILED';
  }
}

export class FakeUserRepository implements UserRepositoryInterface {
  users = new Map<string, UserCredentials>();
  async create(id: string, email: string, passwordHash: string) {
    if (this.users.has(email)) throw httpError(409, 'EMAIL_TAKEN', 'Un compte existe déjà avec cet email.');
    const user = new User({ id, email, createdAt: new Date() });
    this.users.set(email, { user, passwordHash });
    return user;
  }
  async findCredentialsByEmail(email: string) { return this.users.get(email) ?? null; }
  async findById(id: string) {
    return [...this.users.values()].find(credentials => credentials.user.id === id)?.user ?? null;
  }
}

export class FakePasswordHasher implements PasswordHasherInterface {
  async hash(password: string) { return `hashed:${password}`; }
  async verify(password: string, stored: string) { return stored === `hashed:${password}`; }
}

export class FakeTokenService implements TokenServiceInterface {
  async sign(userId: string) { return `token:${userId}`; }
  async verify(token: string) { return token.startsWith('token:') ? token.slice(6) : null; }
}

export async function rejection(promise: Promise<unknown>): Promise<Error & { statusCode?: number; code?: string }> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error('rejet attendu');
}
