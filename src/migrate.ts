import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const migrationsDir = join(process.cwd(), 'db', 'migrations');
  const files = (await readdir(migrationsDir)).filter(file => file.endsWith('.sql')).sort();
  for (const file of files) {
    await pool.query(await readFile(join(migrationsDir, file), 'utf8'));
  }
  const seed = await readFile(join(process.cwd(), 'db', 'seeds', '001_demo.sql'), 'utf8');
  await pool.query(seed);
  console.log('Migrations et données fictives prêtes.');
} finally {
  await pool.end();
}
