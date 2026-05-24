import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import {
  categories,
  ingredients,
  recipes,
  recipeIngredients,
  recipeSteps,
} from '../../lib/db/schema.js';

// schema.org JSON-LD Recipe shape (as saved by fetch.ts)
interface RawRecipe {
  name: string;
  description?: string;
  image?: string | { url: string };
  recipeYield?: number | number[] | string;
  totalTime?: string;
  prepTime?: string;
  cookTime?: string;
  recipeIngredient?: string[];
  recipeInstructions?: unknown[];
  nutrition?: Record<string, string>;
  recipeCategory?: string;
  recipeCuisine?: string;
  _sourceUrl: string;
  _id: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const INPUT_FILE = join(DATA_DIR, 'recipes-raw.json');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 255);
}

function parseIsoDuration(iso: string | undefined): number | null {
  if (!iso) return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return null;
  const hours = parseInt(m[1] ?? '0');
  const mins = parseInt(m[2] ?? '0');
  return hours * 60 + mins || null;
}

function parseServings(raw: RawRecipe['recipeYield']): number {
  if (Array.isArray(raw)) return Number(raw[0]) || 4;
  return Number(raw) || 4;
}

function imageUrl(raw: RawRecipe['image']): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  return raw.url ?? null;
}

// Parse "1000 g Cherrytomaten" → {amount, unit, name}
function parseIngredientString(text: string): { name: string; amount: string | null; unit: string | null } {
  const cleaned = text.trim();

  // Pattern: "100 g Butter" or "2 EL Öl"
  const m1 = cleaned.match(/^([\d.,/]+)\s+([a-zA-ZäöüÄÖÜ]{1,15})\s+(.+)$/);
  if (m1) return { amount: m1[1], unit: m1[2], name: m1[3].trim() };

  // Pattern: "4 Eier" (number + name, no unit)
  const m2 = cleaned.match(/^([\d.,/]+)\s+(.+)$/);
  if (m2) {
    const firstWord = m2[2].split(' ')[0];
    // If first word looks like a unit, treat it as such
    const units = ['g', 'kg', 'ml', 'l', 'el', 'tl', 'stk', 'prise', 'handvoll', 'bund', 'zehe', 'scheibe'];
    if (units.includes(firstWord.toLowerCase())) {
      const rest = m2[2].slice(firstWord.length).trim();
      return { amount: m2[1], unit: firstWord, name: rest || m2[2] };
    }
    return { amount: m2[1], unit: null, name: m2[2].trim() };
  }

  // No number — full string is the ingredient name (e.g. "Olivenöl" or "Salz, nach Geschmack")
  return { amount: null, unit: null, name: cleaned };
}

// Flatten schema.org recipeInstructions into plain strings
function extractSteps(instructions: unknown[]): string[] {
  const steps: string[] = [];
  for (const item of instructions) {
    const i = item as Record<string, unknown>;
    if (i['@type'] === 'HowToSection') {
      const sectionItems = (i.itemListElement as unknown[]) ?? [];
      for (const sub of sectionItems) {
        const s = sub as Record<string, unknown>;
        if (typeof s.text === 'string' && s.text.trim()) steps.push(s.text.trim());
      }
    } else if (i['@type'] === 'HowToStep') {
      if (typeof i.text === 'string' && i.text.trim()) steps.push(i.text.trim());
    } else if (typeof i === 'string' && (i as string).trim()) {
      steps.push((i as string).trim());
    }
  }
  return steps;
}

async function findOrCreateCategory(name: string): Promise<string | null> {
  if (!name) return null;
  const slug = slugify(name);

  const existing = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug));
  if (existing.length > 0) return existing[0].id;

  const inserted = await db
    .insert(categories)
    .values({ name, slug })
    .onConflictDoNothing()
    .returning({ id: categories.id });

  if (inserted.length > 0) return inserted[0].id;

  const retry = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug));
  return retry[0]?.id ?? null;
}

async function findOrCreateIngredient(name: string): Promise<string | null> {
  if (!name) return null;
  const slug = slugify(name);
  if (!slug) return null;

  const existing = await db.select({ id: ingredients.id }).from(ingredients).where(eq(ingredients.slug, slug));
  if (existing.length > 0) return existing[0].id;

  const inserted = await db
    .insert(ingredients)
    .values({ name: name.trim(), slug })
    .onConflictDoNothing()
    .returning({ id: ingredients.id });

  if (inserted.length > 0) return inserted[0].id;

  const retry = await db.select({ id: ingredients.id }).from(ingredients).where(eq(ingredients.slug, slug));
  return retry[0]?.id ?? null;
}

// ─── Import ───────────────────────────────────────────────────────────────────

async function importRecipe(raw: RawRecipe): Promise<void> {
  const title = raw.name?.trim();
  if (!title) {
    console.log(`  Skipping (no name): ${raw._sourceUrl}`);
    return;
  }

  const slug = slugify(title);
  if (!slug) {
    console.log(`  Skipping (empty slug): ${title}`);
    return;
  }

  const existing = await db.select({ id: recipes.id }).from(recipes).where(eq(recipes.slug, slug));
  if (existing.length > 0) {
    console.log(`  Skipping (exists): ${title}`);
    return;
  }

  const categoryName = raw.recipeCategory ?? 'Hauptgericht';
  const categoryId = await findOrCreateCategory(categoryName);

  const prepTime = parseIsoDuration(raw.prepTime);
  const cookTime = parseIsoDuration(raw.cookTime);
  const totalTime = parseIsoDuration(raw.totalTime) ?? (prepTime && cookTime ? prepTime + cookTime : null);

  const [recipe] = await db
    .insert(recipes)
    .values({
      title,
      slug,
      description: raw.description || null,
      imageUrl: imageUrl(raw.image),
      servings: parseServings(raw.recipeYield),
      prepTime,
      cookTime,
      totalTime,
      source: raw._sourceUrl,
      sourceType: 'import',
      isPublished: false,
      categoryId,
    })
    .returning({ id: recipes.id });

  const recipeId = recipe.id;

  // Ingredients
  const ingredientStrings = raw.recipeIngredient ?? [];
  for (let i = 0; i < ingredientStrings.length; i++) {
    const { name, amount, unit } = parseIngredientString(ingredientStrings[i]);
    if (!name) continue;

    const ingredientId = await findOrCreateIngredient(name);
    if (!ingredientId) continue;

    const amountNum = amount ? parseFloat(amount.replace(',', '.')) : null;

    await db.insert(recipeIngredients).values({
      recipeId,
      ingredientId,
      amount: amountNum != null && !isNaN(amountNum) ? String(amountNum) : null,
      unit: unit || null,
      note: ingredientStrings[i], // keep original string as note
      order: i + 1,
      isOptional: false,
    });
  }

  // Steps
  const steps = extractSteps(raw.recipeInstructions ?? []);
  for (let i = 0; i < steps.length; i++) {
    await db.insert(recipeSteps).values({
      recipeId,
      order: i + 1,
      description: steps[i],
    });
  }

  console.log(`Imported: ${title}`);
}

async function main() {
  if (!existsSync(INPUT_FILE)) {
    console.error(`${INPUT_FILE} not found — run import:fetch first`);
    await client.end();
    process.exit(1);
  }

  const rawRecipes: RawRecipe[] = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`Importing ${rawRecipes.length} recipes...`);

  for (const raw of rawRecipes) {
    try {
      await importRecipe(raw);
    } catch (err) {
      console.error(`Failed: ${raw.name}`, err instanceof Error ? err.message : err);
    }
  }

  console.log('Done.');
  await client.end();
}

main().catch(async (err) => {
  console.error('Import failed:', err);
  await client.end();
  process.exit(1);
});
