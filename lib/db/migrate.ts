import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '@/lib/db/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runMigrations() {
  // Apply migrations bundled beside this module. Idempotent.
  await migrate(db, { migrationsFolder: join(__dirname, 'migrations') });
}

// Run directly when executed as a script
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  runMigrations()
    .then(() => {
      console.log('Migrations complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
