import { Pool } from 'pg';

export function createPool(connectionString: string | undefined): Pool {
  return new Pool({ connectionString });
}
