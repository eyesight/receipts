import { and, asc, desc, eq, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from './index';
import {
  ingredientSeasons,
  ocrImports,
  recipeIngredients,
  recipeSteps,
  recipeTags,
  recipes,
  tags,
  type OcrImport,
  type OcrImportInsert,
} from './schema';

// ─── Phase 1: Core ────────────────────────────────────────────────────────────

export async function getRecipes({
  page = 1,
  limit = 20,
  isPublished,
}: {
  page?: number;
  limit?: number;
  isPublished?: boolean;
} = {}) {
  const offset = (page - 1) * limit;
  const where =
    isPublished !== undefined ? eq(recipes.isPublished, isPublished) : undefined;

  return db.query.recipes.findMany({
    where,
    with: {
      category: true,
      recipeTags: { with: { tag: true } },
    },
    limit,
    offset,
    orderBy: [desc(recipes.createdAt)],
  });
}

export async function getRecipeBySlug(slug: string) {
  return db.query.recipes.findFirst({
    where: eq(recipes.slug, slug),
    with: {
      category: true,
      recipeIngredients: {
        with: { ingredient: true },
        orderBy: [asc(recipeIngredients.order)],
      },
      recipeSteps: {
        orderBy: [asc(recipeSteps.order)],
      },
      recipeTags: { with: { tag: true } },
    },
  });
}

export async function searchRecipes(query: string) {
  return db
    .select()
    .from(recipes)
    .where(
      and(
        eq(recipes.isPublished, true),
        sql`${recipes.searchVector} @@ plainto_tsquery('german', ${query})`
      )
    )
    .orderBy(
      desc(sql`ts_rank(${recipes.searchVector}, plainto_tsquery('german', ${query}))`)
    );
}

export async function getRecipesByCategory(categorySlug: string) {
  return db.query.recipes.findMany({
    where: (r, { eq: eqFn }) =>
      and(
        eqFn(r.isPublished, true),
        inArray(
          r.categoryId,
          db
            .select({ id: sql<string>`id` })
            .from(sql`categories`)
            .where(sql`slug = ${categorySlug}`)
        )
      ),
    with: { category: true, recipeTags: { with: { tag: true } } },
    orderBy: (r, { desc: descFn }) => [descFn(r.createdAt)],
  });
}

export async function getRecipesByTag(tagSlug: string) {
  const tagIds = db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.slug, tagSlug));

  const recipeIds = db
    .select({ recipeId: recipeTags.recipeId })
    .from(recipeTags)
    .where(inArray(recipeTags.tagId, tagIds));

  return db
    .select()
    .from(recipes)
    .where(and(eq(recipes.isPublished, true), inArray(recipes.id, recipeIds)))
    .orderBy(desc(recipes.createdAt));
}

// ─── Phase 1: Suggestions ─────────────────────────────────────────────────────

export async function getRecipesBySeason(month: number, region = 'CH') {
  const seasonalIngredientIds = db
    .select({ id: ingredientSeasons.ingredientId })
    .from(ingredientSeasons)
    .where(
      and(eq(ingredientSeasons.month, month), eq(ingredientSeasons.region, region))
    );

  const seasonalRecipeIds = db
    .selectDistinct({ recipeId: recipeIngredients.recipeId })
    .from(recipeIngredients)
    .where(inArray(recipeIngredients.ingredientId, seasonalIngredientIds));

  return db
    .select()
    .from(recipes)
    .where(and(eq(recipes.isPublished, true), inArray(recipes.id, seasonalRecipeIds)))
    .orderBy(desc(recipes.rating), desc(recipes.viewCount));
}

export async function getEasyRecipes(maxMinutes?: number) {
  const baseCondition = eq(recipes.isPublished, true);

  if (maxMinutes !== undefined) {
    return db
      .select()
      .from(recipes)
      .where(
        and(
          baseCondition,
          or(eq(recipes.difficulty, 'easy'), lte(recipes.totalTime, maxMinutes))
        )
      )
      .orderBy(asc(recipes.totalTime), desc(recipes.rating));
  }

  return db
    .select()
    .from(recipes)
    .where(and(baseCondition, eq(recipes.difficulty, 'easy')))
    .orderBy(asc(recipes.totalTime), desc(recipes.rating));
}

export async function getPopularRecipes(limit = 10) {
  return db
    .select()
    .from(recipes)
    .where(eq(recipes.isPublished, true))
    .orderBy(desc(recipes.rating), desc(recipes.viewCount))
    .limit(limit);
}

export async function getSuggestedRecipes(criteria: {
  month?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  maxTime?: number;
  tags?: string[];
}) {
  const { month, difficulty, maxTime, tags: tagSlugs } = criteria;

  const conditions = [eq(recipes.isPublished, true)];

  if (difficulty) {
    conditions.push(eq(recipes.difficulty, difficulty));
  }

  if (maxTime !== undefined) {
    conditions.push(lte(recipes.totalTime, maxTime));
  }

  if (tagSlugs?.length) {
    const tagIds = db
      .select({ id: tags.id })
      .from(tags)
      .where(inArray(tags.slug, tagSlugs));

    const recipeIdsWithTags = db
      .selectDistinct({ recipeId: recipeTags.recipeId })
      .from(recipeTags)
      .where(inArray(recipeTags.tagId, tagIds));

    conditions.push(inArray(recipes.id, recipeIdsWithTags));
  }

  if (month !== undefined) {
    const seasonalIngredientIds = db
      .select({ id: ingredientSeasons.ingredientId })
      .from(ingredientSeasons)
      .where(and(eq(ingredientSeasons.month, month), eq(ingredientSeasons.region, 'CH')));

    const seasonalRecipeIds = db
      .selectDistinct({ recipeId: recipeIngredients.recipeId })
      .from(recipeIngredients)
      .where(inArray(recipeIngredients.ingredientId, seasonalIngredientIds));

    conditions.push(inArray(recipes.id, seasonalRecipeIds));
  }

  return db
    .select()
    .from(recipes)
    .where(and(...conditions))
    .orderBy(desc(recipes.rating), desc(recipes.viewCount));
}

// ─── Phase 1: OCR ─────────────────────────────────────────────────────────────

export async function createOcrImport(imageUrl: string): Promise<OcrImport> {
  const [result] = await db
    .insert(ocrImports)
    .values({ imageUrl, status: 'pending' })
    .returning();
  return result;
}

export async function updateOcrImport(
  id: string,
  data: Partial<OcrImportInsert>
): Promise<OcrImport> {
  const [result] = await db
    .update(ocrImports)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(ocrImports.id, id))
    .returning();
  return result;
}

export async function getRecentOcrImports(limit = 10) {
  return db.query.ocrImports.findMany({
    with: { recipe: true },
    orderBy: [desc(ocrImports.createdAt)],
    limit,
  });
}

// ─── Phase 2+: Stubs (not yet implemented) ───────────────────────────────────
// getRecipesByPantry(userId: string)         → Phase 3
// generateShoppingList(recipeIds, userId)    → Phase 3
// getPantryItems(userId: string)             → Phase 3
