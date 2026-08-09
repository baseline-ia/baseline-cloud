import { drizzle } from 'drizzle-orm/postgres-js';
import { sql as drizzleSql } from 'drizzle-orm';
import postgres from 'postgres';
import { config } from '@/lib/config';
import * as schema from './schema';

function createDb() {
  const client = postgres(config.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 1800,
  });
  return drizzle(client, { schema });
}

export const db = createDb();
export { schema };
export type Db = typeof db;

export async function checkDbHealth(): Promise<boolean> {
  try {
    await db.execute(drizzleSql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}
