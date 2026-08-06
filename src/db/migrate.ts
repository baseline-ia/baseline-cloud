import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  // Apply migrations bundled beside this module. Idempotent.
  await migrate(db, { migrationsFolder: join(__dirname, 'migrations') });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}
