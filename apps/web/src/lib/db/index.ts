import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// For Cloudflare Workers deploy, swap to drizzle-orm/neon-serverless + @neondatabase/serverless
const connectionString = import.meta.env.DATABASE_URL as string | undefined;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export type Database = typeof db;
