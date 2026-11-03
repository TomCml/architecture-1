import type { Pool } from 'pg';
import { AppError } from '../errors.js';
import type { UserView } from '../types.js';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

function toView(row: UserRow): UserView {
  return {
    id: row.id,
    email: row.email,
    createdAt: row.created_at.toISOString(),
  };
}

export class UserRepository {
  constructor(private readonly pool: Pool) {}

  async create(id: string, email: string, passwordHash: string): Promise<UserView> {
    try {
      const result = await this.pool.query<UserRow>(
        'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
        [id, email, passwordHash],
      );
      return toView(result.rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new AppError(409, 'EMAIL_TAKEN', 'Un compte existe déjà avec cet email.');
      }
      throw error;
    }
  }

  async findCredentialsByEmail(email: string): Promise<{ user: UserView; passwordHash: string } | null> {
    const result = await this.pool.query<UserRow>('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
    const row = result.rows[0];
    return row ? { user: toView(row), passwordHash: row.password_hash } : null;
  }

  async findById(id: string): Promise<UserView | null> {
    const result = await this.pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ? toView(result.rows[0]) : null;
  }
}
