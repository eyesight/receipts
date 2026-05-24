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
import type { ExtractedRecipe } from './index';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function uniqueRecipeSlug(base: string): Promise<string> {
  let slug = base;
  let i = 1;
  while (true) {
    const existing = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.slug, slug))
      .limit(1);
    if (!existing.length) return slug;
    slug = `${base}-${i++}`;
  }
}

export async function saveOcrRecipe(
  extracted: ExtractedRecipe,
  ocrImportId: string,
  createdBy?: string
): Promise<{ slug: string; title: string }> {
  // Find or create category
  let categoryId: string | null = null;
  if (extracted.category) {
    const catSlug = slugify(extracted.category);
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, catSlug))
      .limit(1);
    if (existing) {
      categoryId = existing.id;
    } else {
      const [created] = await db
        .insert(categories)
        .values({ name: extracted.category, slug: catSlug })
        .returning({ id: categories.id });
      categoryId = created.id;
    }
  }

  // Build recipe slug
  const baseSlug = slugify(extracted.title) || 'recipe';
  const slug = await uniqueRecipeSlug(baseSlug);

  const prepTime = extracted.prepTime ?? undefined;
  const cookTime = extracted.cookTime ?? undefined;
  const totalTime =
    prepTime !== undefined || cookTime !== undefined
      ? (prepTime ?? 0) + (cookTime ?? 0)
      : undefined;

  // Insert recipe
  const [recipe] = await db
    .insert(recipes)
    .values({
      title: extracted.title,
      slug,
      description: extracted.description ?? undefined,
      servings: extracted.servings ?? undefined,
      prepTime,
      cookTime,
      totalTime,
      difficulty: extracted.difficulty ?? undefined,
      categoryId: categoryId ?? undefined,
      source: extracted.source ?? undefined,
      sourceType: 'ocr',
      createdBy,
      isPublished: false,
    })
    .returning({ id: recipes.id, slug: recipes.slug, title: recipes.title });

  const recipeId = recipe.id;

  // Find or create ingredients and create join rows
  for (let i = 0; i < extracted.ingredients.length; i++) {
    const ing = extracted.ingredients[i];
    const ingSlug = slugify(ing.name);

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
        .values({ name: ing.name, slug: ingSlug, unit: ing.unit ?? undefined })
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

  // Insert steps
  if (extracted.steps.length > 0) {
    await db.insert(recipeSteps).values(
      extracted.steps.map((step) => ({
        recipeId,
        order: step.order,
        title: step.title ?? undefined,
        description: step.description,
        duration: step.duration ?? undefined,
        tip: step.tip ?? undefined,
      }))
    );
  }

  // Find or create tags and create join rows
  for (const tagName of extracted.tags) {
    const tagSlug = slugify(tagName);

    let tagId: string;
    const [existing] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.slug, tagSlug))
      .limit(1);

    if (existing) {
      tagId = existing.id;
    } else {
      const [created] = await db
        .insert(tags)
        .values({ name: tagName, slug: tagSlug, type: 'general' })
        .returning({ id: tags.id });
      tagId = created.id;
    }

    await db.insert(recipeTags).values({ recipeId, tagId });
  }

  // Mark import as done
  await db
    .update(ocrImports)
    .set({
      recipeId,
      status: 'done',
      parsedData: extracted as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(ocrImports.id, ocrImportId));

  return { slug: recipe.slug, title: recipe.title };
}
