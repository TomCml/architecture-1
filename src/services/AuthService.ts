import { randomUUID } from 'node:crypto';
import { AppError } from '../errors.js';
import { PasswordHasher } from '../integrations/PasswordHasher.js';
import { TokenIssuer } from '../integrations/TokenIssuer.js';
import { UserRepository } from '../repositories/UserRepository.js';
import type { UserView } from '../types.js';

export interface AuthConfig {
  jwtSecret: string;
  tokenTtlMinutes: number;
  cookieSecure: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthService {
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenIssuer,
  ) {}

  async register(email: string, password: string): Promise<{ user: UserView; token: string }> {
    const normalized = email.trim().toLowerCase();
    if (normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) {
      throw new AppError(400, 'INVALID_INPUT', 'Indiquez un email valide.');
    }
    if (password.length < 8 || password.length > 128) {
      throw new AppError(400, 'INVALID_INPUT', 'Le mot de passe doit contenir entre 8 et 128 caractères.');
    }
    if (await this.users.findCredentialsByEmail(normalized)) {
      throw new AppError(409, 'EMAIL_TAKEN', 'Un compte existe déjà avec cet email.');
    }
    const user = await this.users.create(randomUUID(), normalized, await this.hasher.hash(password));
    return { user, token: await this.tokens.sign(user.id) };
  }

  async login(email: string, password: string): Promise<{ user: UserView; token: string }> {
    const credentials = await this.users.findCredentialsByEmail(email.trim().toLowerCase());
    if (!credentials) {
      this.dummyHash ??= this.hasher.hash('mot-de-passe-factice');
      await this.hasher.verify(password, await this.dummyHash);
      throw this.invalidCredentials();
    }
    if (!(await this.hasher.verify(password, credentials.passwordHash))) throw this.invalidCredentials();
    return { user: credentials.user, token: await this.tokens.sign(credentials.user.id) };
  }

  async getCurrentUser(token: string | undefined): Promise<UserView> {
    const userId = token ? await this.tokens.verify(token) : null;
    const user = userId ? await this.users.findById(userId) : null;
    if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Authentification requise.');
    return user;
  }

  private invalidCredentials(): AppError {
    return new AppError(401, 'INVALID_CREDENTIALS', 'Email ou mot de passe incorrect.');
  }
}
