import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { recipes } from '../../lib/db/schema.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

async function main() {
  const deleted = await db
    .delete(recipes)
    .where(eq(recipes.sourceType, 'import'))
    .returning({ id: recipes.id, title: recipes.title });

  console.log(`Deleted ${deleted.length} imported recipes`);
  for (const r of deleted) {
    console.log(`  - ${r.title} (${r.id})`);
  }

  await client.end();
}

main().catch(async (err) => {
  console.error('Cleanup failed:', err);
  await client.end();
  process.exit(1);
});
