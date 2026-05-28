import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  categories,
  ingredients,
  ocrImports,
  recipeIngredients,
  recipeSteps,
  recipeTags,
  recipes,
  tags,
} from '@/lib/db/schema';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

interface IngredientInput {
  name: string;
  amount: number | null;
  unit: string | null;
  note: string | null;
  isOptional: boolean;
  group: string | null;
}

interface StepInput {
  order: number;
  title: string | null;
  description: string;
  duration: number | null;
  tip: string | null;
}

interface RecipeInput {
  title: string;
  description: string | null;
  servings: number | null;
  prepTime: number | null;
  cookTime: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  category: string | null;
  source: string | null;
  isPublished: boolean;
  imageUrl?: string | null;
  createdBy?: string | null;
  ingredients: IngredientInput[];
  steps: StepInput[];
  tags: string[];
}

export const PATCH: APIRoute = async ({ params, request }) => {
  const { slug } = params;
  if (!slug) return json({ error: 'Missing slug' }, 400);

  const [existing] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.slug, slug))
    .limit(1);

  if (!existing) return json({ error: 'Recipe not found' }, 404);

  const body = await request.json() as RecipeInput;
  const recipeId = existing.id;

  // Find or create category
  let categoryId: string | null = null;
  if (body.category?.trim()) {
    const catSlug = slugify(body.category.trim());
    const [existingCat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, catSlug))
      .limit(1);
    if (existingCat) {
      categoryId = existingCat.id;
    } else {
      const [created] = await db
        .insert(categories)
        .values({ name: body.category.trim(), slug: catSlug })
        .returning({ id: categories.id });
      categoryId = created.id;
    }
  }

  const prepTime = body.prepTime ?? undefined;
  const cookTime = body.cookTime ?? undefined;
  const totalTime =
    prepTime !== undefined || cookTime !== undefined
      ? (prepTime ?? 0) + (cookTime ?? 0)
      : undefined;

  // Update recipe row
  await db
    .update(recipes)
    .set({
      title: body.title,
      description: body.description ?? undefined,
      servings: body.servings ?? undefined,
      prepTime,
      cookTime,
      totalTime,
      difficulty: body.difficulty ?? undefined,
      categoryId: categoryId ?? undefined,
      source: body.source ?? undefined,
      createdBy: body.createdBy ?? undefined,
      isPublished: body.isPublished,
      imageUrl: body.imageUrl ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(recipes.id, recipeId));

  // Replace ingredients
  await db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId));
  for (let i = 0; i < body.ingredients.length; i++) {
    const ing = body.ingredients[i];
    if (!ing.name?.trim()) continue;

    const ingSlug = slugify(ing.name.trim());
    let ingredientId: string;
    const [existingIng] = await db
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(eq(ingredients.slug, ingSlug))
      .limit(1);

    if (existingIng) {
      ingredientId = existingIng.id;
    } else {
      const [created] = await db
        .insert(ingredients)
        .values({ name: ing.name.trim(), slug: ingSlug, unit: ing.unit ?? undefined })
        .returning({ id: ingredients.id });
      ingredientId = created.id;
    }

    await db.insert(recipeIngredients).values({
      recipeId,
      ingredientId,
      amount: ing.amount !== null ? String(ing.amount) : undefined,
      unit: ing.unit ?? undefined,
      note: ing.note ?? undefined,
      isOptional: ing.isOptional,
      order: i + 1,
      group: ing.group ?? undefined,
    });
  }

  // Replace steps
  await db.delete(recipeSteps).where(eq(recipeSteps.recipeId, recipeId));
  const validSteps = body.steps.filter((s) => s.description?.trim());
  if (validSteps.length > 0) {
    await db.insert(recipeSteps).values(
      validSteps.map((step, i) => ({
        recipeId,
        order: i + 1,
        title: step.title?.trim() || undefined,
        description: step.description.trim(),
        duration: step.duration ?? undefined,
        tip: step.tip?.trim() || undefined,
      }))
    );
  }

  // Replace tags
  await db.delete(recipeTags).where(eq(recipeTags.recipeId, recipeId));
  for (const tagName of body.tags) {
    if (!tagName?.trim()) continue;
    const tagSlug = slugify(tagName.trim());
    let tagId: string;
    const [existingTag] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.slug, tagSlug))
      .limit(1);

    if (existingTag) {
      tagId = existingTag.id;
    } else {
      const [created] = await db
        .insert(tags)
        .values({ name: tagName.trim(), slug: tagSlug, type: 'general' })
        .returning({ id: tags.id });
      tagId = created.id;
    }
    await db.insert(recipeTags).values({ recipeId, tagId });
  }

  // If publishing for the first time, update any linked ocr_import
  if (body.isPublished) {
    await db
      .update(ocrImports)
      .set({ updatedAt: new Date() })
      .where(eq(ocrImports.recipeId, recipeId));
  }

  return json({ success: true, slug });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
