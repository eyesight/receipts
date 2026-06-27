import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { recipes } from '../../lib/db/schema.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

const TAG = 'Samsung Food Import';
const CONTENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../content/recipes');

function addTagToFrontmatter(content: string): string | null {
  if (content.includes(`"${TAG}"`)) return null; // already present

  // tags: followed by empty list
  if (/^tags:\n\s+\[\]/m.test(content)) {
    return content.replace(/^(tags:\n)\s+\[\]/m, `$1  - "${TAG}"`);
  }

  // tags: followed by existing items — append after the last tag line
  if (/^tags:\n(?:  - [^\n]+\n)/m.test(content)) {
    return content.replace(
      /^(tags:\n(?:  - [^\n]+\n)+)/m,
      `$1  - "${TAG}"\n`
    );
  }

  return null;
}

async function main() {
  const imported = await db
    .select({ slug: recipes.slug, title: recipes.title })
    .from(recipes)
    .where(eq(recipes.sourceType, 'import'));

  console.log(`Found ${imported.length} imported recipes`);

  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const recipe of imported) {
    const filePath = resolve(CONTENT_DIR, `${recipe.slug}.md`);

    if (!existsSync(filePath)) {
      console.log(`  Missing file: ${recipe.slug}.md`);
      missing++;
      continue;
    }

    const original = readFileSync(filePath, 'utf-8');
    const patched = addTagToFrontmatter(original);

    if (!patched) {
      skipped++;
      continue;
    }

    writeFileSync(filePath, patched, 'utf-8');
    console.log(`  Updated: ${recipe.title}`);
    updated++;
  }

  console.log(`\nDone — ${updated} updated, ${skipped} already had tag, ${missing} files missing`);
  await client.end();
}

main().catch(async (err) => {
  console.error('Failed:', err);
  await client.end();
  process.exit(1);
});
