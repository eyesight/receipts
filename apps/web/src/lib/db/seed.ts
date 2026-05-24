import { inArray } from 'drizzle-orm';
import { db } from './index';
import { categories, ingredients, ingredientSeasons, tags } from './schema';

async function seed() {
  console.log('Seeding database...');

  // ─── Categories ─────────────────────────────────────────────────────────────
  await db
    .insert(categories)
    .values([
      { name: 'Hauptgericht', slug: 'hauptgericht', description: 'Herzhafte Hauptspeisen für jeden Tag' },
      { name: 'Vorspeise', slug: 'vorspeise', description: 'Leichte Einstimmung auf das Menü' },
      { name: 'Dessert', slug: 'dessert', description: 'Süsse Nachspeisen und Kuchen' },
      { name: 'Snack', slug: 'snack', description: 'Kleine Häppchen und Zwischenmahlzeiten' },
      { name: 'Getränk', slug: 'getraenk', description: 'Heisse und kalte Getränke' },
    ])
    .onConflictDoNothing();

  // ─── Tags ────────────────────────────────────────────────────────────────────
  await db
    .insert(tags)
    .values([
      { name: 'Vegetarisch', slug: 'vegetarisch', type: 'diet' },
      { name: 'Vegan', slug: 'vegan', type: 'diet' },
      { name: 'Glutenfrei', slug: 'glutenfrei', type: 'diet' },
      { name: 'Lactosefrei', slug: 'lactosefrei', type: 'diet' },
      { name: 'Schnell', slug: 'schnell', type: 'general' },
      { name: 'Familienküche', slug: 'familienkueche', type: 'general' },
      { name: 'Schweizer Küche', slug: 'schweiz', type: 'cuisine' },
      { name: 'Italienisch', slug: 'italienisch', type: 'cuisine' },
      { name: 'Weihnachten', slug: 'weihnachten', type: 'occasion' },
      { name: 'Ostern', slug: 'ostern', type: 'occasion' },
    ])
    .onConflictDoNothing();

  // ─── Ingredients ─────────────────────────────────────────────────────────────
  await db
    .insert(ingredients)
    .values([
      { name: 'Apfel', slug: 'apfel', unit: 'stk' },
      { name: 'Karotte', slug: 'karotte', unit: 'stk' },
      { name: 'Tomate', slug: 'tomate', unit: 'stk' },
      { name: 'Zucchini', slug: 'zucchini', unit: 'stk' },
      { name: 'Spinat', slug: 'spinat', unit: 'g' },
    ])
    .onConflictDoNothing();

  const seedIngredients = await db
    .select()
    .from(ingredients)
    .where(inArray(ingredients.slug, ['apfel', 'karotte', 'tomate', 'zucchini', 'spinat']));

  const bySlug = Object.fromEntries(seedIngredients.map((i) => [i.slug, i.id]));

  // ─── Seasonality (Switzerland) ───────────────────────────────────────────────
  // Source: swisspatat / Schweizer Saisonkalender
  const seasonData: Array<{ ingredientId: string; month: number; region: string }> = [
    // Apfel: September – März
    ...[9, 10, 11, 12, 1, 2, 3].map((month) => ({
      ingredientId: bySlug['apfel'],
      month,
      region: 'CH',
    })),
    // Karotte: Juni – November
    ...[6, 7, 8, 9, 10, 11].map((month) => ({
      ingredientId: bySlug['karotte'],
      month,
      region: 'CH',
    })),
    // Tomate: Juli – September
    ...[7, 8, 9].map((month) => ({
      ingredientId: bySlug['tomate'],
      month,
      region: 'CH',
    })),
    // Zucchini: Juni – September
    ...[6, 7, 8, 9].map((month) => ({
      ingredientId: bySlug['zucchini'],
      month,
      region: 'CH',
    })),
    // Spinat: März – Mai, September – November
    ...[3, 4, 5, 9, 10, 11].map((month) => ({
      ingredientId: bySlug['spinat'],
      month,
      region: 'CH',
    })),
  ].filter((d) => d.ingredientId != null);

  if (seasonData.length > 0) {
    await db.insert(ingredientSeasons).values(seasonData).onConflictDoNothing();
  }

  console.log('Seeding complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
