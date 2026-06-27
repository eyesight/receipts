import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';
import { recipes, tags, recipeTags } from '../../lib/db/schema.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

const TAG_NAME = 'Samsung Food Import';
const TAG_SLUG = 'samsung-food-import';

async function main() {
  // Find or create the tag
  const [existingTag] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.slug, TAG_SLUG))
    .limit(1);

  let tagId: string;
  if (existingTag) {
    tagId = existingTag.id;
    console.log(`Tag exists: ${TAG_NAME}`);
  } else {
    const [created] = await db
      .insert(tags)
      .values({ name: TAG_NAME, slug: TAG_SLUG, type: 'general' })
      .returning({ id: tags.id });
    tagId = created.id;
    console.log(`Created tag: ${TAG_NAME}`);
  }

  // Find all imported recipes
  const imported = await db
    .select({ id: recipes.id, title: recipes.title })
    .from(recipes)
    .where(eq(recipes.sourceType, 'import'));

  console.log(`Found ${imported.length} imported recipes`);

  let added = 0;
  let skipped = 0;

  for (const recipe of imported) {
    const [existing] = await db
      .select()
      .from(recipeTags)
      .where(and(eq(recipeTags.recipeId, recipe.id), eq(recipeTags.tagId, tagId)))
      .limit(1);

    if (existing) {
      skipped++;
      continue;
    }

    await db.insert(recipeTags).values({ recipeId: recipe.id, tagId, source: 'import' });
    console.log(`  Tagged: ${recipe.title}`);
    added++;
  }

  console.log(`Done — ${added} tagged, ${skipped} already had the tag`);
  await client.end();
}

main().catch(async (err) => {
  console.error('Failed:', err);
  await client.end();
  process.exit(1);
});
