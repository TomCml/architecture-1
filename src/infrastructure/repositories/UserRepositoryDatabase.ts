import type { Pool } from 'pg';
import { User } from '../../domain/entities/User.js';
import type { UserCredentials, UserRepositoryInterface } from '../../domain/interfaces/UserRepositoryInterface.js';
import { httpError } from '../../utility/httpError.js';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

function toEntity(row: UserRow): User {
  return new User({ id: row.id, email: row.email, createdAt: row.created_at });
}

export class UserRepositoryDatabase implements UserRepositoryInterface {
  constructor(private readonly pool: Pool) {}

  async create(id: string, email: string, passwordHash: string): Promise<User> {
    try {
      const result = await this.pool.query<UserRow>(
        'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
        [id, email, passwordHash],
      );
      return toEntity(result.rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw httpError(409, 'EMAIL_TAKEN', 'Un compte existe déjà avec cet email.');
      }
      throw error;
    }
  }

  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    const result = await this.pool.query<UserRow>('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
    const row = result.rows[0];
    return row ? { user: toEntity(row), passwordHash: row.password_hash } : null;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }
}
