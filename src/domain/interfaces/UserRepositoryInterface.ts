import type { User } from '../entities/User.js';

export interface UserCredentials {
  user: User;
  passwordHash: string;
}

export interface UserRepositoryInterface {
  create(id: string, email: string, passwordHash: string): Promise<User>;
  findCredentialsByEmail(email: string): Promise<UserCredentials | null>;
  findById(id: string): Promise<User | null>;
}
