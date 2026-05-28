import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { ingredients, recipeIngredients, recipeSteps, recipes } from '@/lib/db/schema';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let i = 1;
  while (true) {
    const [existing] = await db.select({ id: recipes.id }).from(recipes).where(eq(recipes.slug, slug)).limit(1);
    if (!existing) return slug;
    slug = `${base}-${i++}`;
  }
}

interface IngredientInput { name: string; amount: string; unit: string; }

interface RecipeInput {
  title: string;
  description?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  ingredients: IngredientInput[];
  instructions?: string;
  imageUrl?: string;
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json() as RecipeInput;

  if (!body.title?.trim()) return json({ error: 'Title is required' }, 400);

  const baseSlug = slugify(body.title.trim()) || 'recipe';
  const slug = await uniqueSlug(baseSlug);

  const prepTime = body.prepTimeMinutes ?? undefined;
  const cookTime = body.cookTimeMinutes ?? undefined;
  const totalTime =
    prepTime !== undefined || cookTime !== undefined
      ? (prepTime ?? 0) + (cookTime ?? 0)
      : undefined;

  const [recipe] = await db
    .insert(recipes)
    .values({
      title: body.title.trim(),
      slug,
      description: body.description?.trim() || undefined,
      servings: body.servings ?? undefined,
      prepTime,
      cookTime,
      totalTime,
      imageUrl: body.imageUrl || undefined,
      sourceType: 'manual',
      isPublished: false,
    })
    .returning({ id: recipes.id, slug: recipes.slug });

  const recipeId = recipe.id;

  for (let i = 0; i < body.ingredients.length; i++) {
    const ing = body.ingredients[i];
    if (!ing.name?.trim()) continue;

    const ingSlug = slugify(ing.name.trim());
    let ingredientId: string;
    const [existing] = await db
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(eq(ingredients.slug, ingSlug))
      .limit(1);

    if (existing) {
      ingredientId = existing.id;
    } else {
      const [created] = await db
        .insert(ingredients)
        .values({ name: ing.name.trim(), slug: ingSlug, unit: ing.unit || undefined })
        .returning({ id: ingredients.id });
      ingredientId = created.id;
    }

    await db.insert(recipeIngredients).values({
      recipeId,
      ingredientId,
      amount: ing.amount ? ing.amount : undefined,
      unit: ing.unit || undefined,
      order: i + 1,
    });
  }

  if (body.instructions?.trim()) {
    await db.insert(recipeSteps).values({
      recipeId,
      order: 1,
      description: body.instructions.trim(),
    });
  }

  return json({ success: true, slug });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
