import type { User } from '../../../domain/entities/User.js';
import type { TokenServiceInterface } from '../../../domain/interfaces/TokenServiceInterface.js';
import type { UserRepositoryInterface } from '../../../domain/interfaces/UserRepositoryInterface.js';
import { httpError } from '../../../utility/httpError.js';

export class GetCurrentUserUseCase {
  constructor(
    private readonly users: UserRepositoryInterface,
    private readonly tokens: TokenServiceInterface,
  ) {}

  async execute(token: string | undefined): Promise<User> {
    const userId = token ? await this.tokens.verify(token) : null;
    const user = userId ? await this.users.findById(userId) : null;
    if (!user) throw httpError(401, 'UNAUTHENTICATED', 'Authentification requise.');
    return user;
  }
}
