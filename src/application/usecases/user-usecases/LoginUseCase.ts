import { User } from '../../../domain/entities/User.js';
import type { PasswordHasherInterface } from '../../../domain/interfaces/PasswordHasherInterface.js';
import type { TokenServiceInterface } from '../../../domain/interfaces/TokenServiceInterface.js';
import type { UserRepositoryInterface } from '../../../domain/interfaces/UserRepositoryInterface.js';
import { httpError } from '../../../utility/httpError.js';
import type { AuthResult } from './RegisterUseCase.js';

export class LoginUseCase {
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly users: UserRepositoryInterface,
    private readonly hasher: PasswordHasherInterface,
    private readonly tokens: TokenServiceInterface,
  ) {}

  async execute(email: string, password: string): Promise<AuthResult> {
    const credentials = await this.users.findCredentialsByEmail(User.normalizeEmail(email));
    if (!credentials) {
      this.dummyHash ??= this.hasher.hash('mot-de-passe-factice');
      await this.hasher.verify(password, await this.dummyHash);
      throw this.invalidCredentials();
    }
    if (!(await this.hasher.verify(password, credentials.passwordHash))) throw this.invalidCredentials();
    return { user: credentials.user, token: await this.tokens.sign(credentials.user.id) };
  }

  private invalidCredentials(): Error {
    return httpError(401, 'INVALID_CREDENTIALS', 'Email ou mot de passe incorrect.');
  }
}
