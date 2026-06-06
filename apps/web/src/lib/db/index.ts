import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = import.meta.env.DATABASE_URL as string | undefined;

if (!connectionString) {
  console.warn('[db] DATABASE_URL not set — database disabled for static build');
}

const client = connectionString ? postgres(connectionString, { prepare: false }) : null;
export const db = (client ? drizzle(client, { schema }) : null) as ReturnType<typeof drizzle<typeof schema>>;
export type Database = typeof db;
