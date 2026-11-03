import { User } from '../../../domain/entities/User.js';
import type { PasswordHasherInterface } from '../../../domain/interfaces/PasswordHasherInterface.js';
import type { TokenServiceInterface } from '../../../domain/interfaces/TokenServiceInterface.js';
import type { UserRepositoryInterface } from '../../../domain/interfaces/UserRepositoryInterface.js';
import { httpError } from '../../../utility/httpError.js';
import { newId } from '../../../utility/id.js';

export interface AuthResult {
  user: User;
  token: string;
}

export class RegisterUseCase {
  constructor(
    private readonly users: UserRepositoryInterface,
    private readonly hasher: PasswordHasherInterface,
    private readonly tokens: TokenServiceInterface,
  ) {}

  async execute(email: string, password: string): Promise<AuthResult> {
    const normalized = User.normalizeEmail(email);
    if (!User.isValidEmail(normalized)) {
      throw httpError(400, 'INVALID_INPUT', 'Indiquez un email valide.');
    }
    if (!User.isValidPassword(password)) {
      throw httpError(400, 'INVALID_INPUT', 'Le mot de passe doit contenir entre 8 et 128 caractères.');
    }
    if (await this.users.findCredentialsByEmail(normalized)) {
      throw httpError(409, 'EMAIL_TAKEN', 'Un compte existe déjà avec cet email.');
    }
    const user = await this.users.create(newId(), normalized, await this.hasher.hash(password));
    return { user, token: await this.tokens.sign(user.id) };
  }
}
