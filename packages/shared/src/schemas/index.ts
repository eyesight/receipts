import { z } from 'zod';

// Re-export legacy OCR/input schemas for backwards compatibility
export * from './recipe.js';

// ─── Base primitives ─────────────────────────────────────────────────────────

export const uuidSchema = z.string().uuid();

export const dbSlugSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');

export const timestampSchema = z.coerce.date();

// ─── Enums ────────────────────────────────────────────────────────────────────

export const tagTypeSchema = z.enum(['diet', 'cuisine', 'occasion', 'general']);
export const difficultySchema = z.enum(['easy', 'medium', 'hard']);
export const sourceTypeSchema = z.enum(['ocr', 'manual', 'import']);
export const storeSchema = z.enum(['coop', 'migros', 'aldi', 'lidl', 'other']);
export const ocrStatusSchema = z.enum(['pending', 'processing', 'done', 'error']);

// ─── Category ─────────────────────────────────────────────────────────────────

export const categorySchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(100),
  slug: dbSlugSchema.max(100),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const categoryCreateSchema = categorySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

// ─── Tag ──────────────────────────────────────────────────────────────────────

export const tagSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(100),
  slug: dbSlugSchema.max(100),
  type: tagTypeSchema,
});

export const tagCreateSchema = tagSchema.omit({ id: true });
export const tagUpdateSchema = tagCreateSchema.partial();

// ─── Ingredient ───────────────────────────────────────────────────────────────

export const ingredientDbSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(100),
  slug: dbSlugSchema.max(100),
  unit: z.string().max(50).nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const ingredientDbCreateSchema = ingredientDbSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const ingredientDbUpdateSchema = ingredientDbCreateSchema.partial();

// ─── IngredientSeason ─────────────────────────────────────────────────────────

export const ingredientSeasonSchema = z.object({
  id: uuidSchema,
  ingredientId: uuidSchema,
  month: z.number().int().min(1).max(12),
  region: z.string().max(10).default('CH'),
});

export const ingredientSeasonCreateSchema = ingredientSeasonSchema.omit({ id: true });

// ─── Recipe ───────────────────────────────────────────────────────────────────

// postgres.js returns DECIMAL columns as strings
const decimalStringSchema = z.string().regex(/^\d+(\.\d+)?$/).nullable();

export const recipeDbSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1).max(255),
  slug: dbSlugSchema,
  description: z.string().nullable(),
  servings: z.number().int().positive().nullable().default(4),
  prepTime: z.number().int().nonnegative().nullable(),
  cookTime: z.number().int().nonnegative().nullable(),
  totalTime: z.number().int().nonnegative().nullable(),
  difficulty: difficultySchema.nullable(),
  categoryId: uuidSchema.nullable(),
  imageUrl: z.string().nullable(),
  source: z.string().nullable(),
  sourceType: sourceTypeSchema.default('manual'),
  isPublished: z.boolean().default(false),
  viewCount: z.number().int().default(0),
  favoriteCount: z.number().int().default(0),
  rating: decimalStringSchema,
  ratingCount: z.number().int().default(0),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const recipeDbCreateSchema = recipeDbSchema
  .omit({ id: true, createdAt: true, updatedAt: true, viewCount: true, favoriteCount: true, ratingCount: true })
  .extend({ rating: decimalStringSchema.optional() });

export const recipeDbUpdateSchema = recipeDbCreateSchema.partial();

// ─── RecipeIngredient ─────────────────────────────────────────────────────────

export const recipeIngredientSchema = z.object({
  id: uuidSchema,
  recipeId: uuidSchema,
  ingredientId: uuidSchema,
  amount: decimalStringSchema,
  unit: z.string().max(50).nullable(),
  note: z.string().max(255).nullable(),
  isOptional: z.boolean().default(false),
  order: z.number().int(),
  group: z.string().max(100).nullable(),
});

export const recipeIngredientCreateSchema = recipeIngredientSchema.omit({ id: true });

// ─── RecipeStep ───────────────────────────────────────────────────────────────

export const recipeStepDbSchema = z.object({
  id: uuidSchema,
  recipeId: uuidSchema,
  order: z.number().int(),
  title: z.string().max(255).nullable(),
  description: z.string().min(1),
  duration: z.number().int().nullable(),
  imageUrl: z.string().nullable(),
  tip: z.string().nullable(),
});

export const recipeStepDbCreateSchema = recipeStepDbSchema.omit({ id: true });

// ─── RecipeTag ────────────────────────────────────────────────────────────────

export const recipeTagSchema = z.object({
  recipeId: uuidSchema,
  tagId: uuidSchema,
});

// ─── StoreProduct (Phase 3) ───────────────────────────────────────────────────

export const storeProductSchema = z.object({
  id: uuidSchema,
  ingredientId: uuidSchema.nullable(),
  store: storeSchema,
  productName: z.string().min(1),
  productUrl: z.string().nullable(),
  price: decimalStringSchema,
  pricePerUnit: decimalStringSchema,
  unit: z.string().max(50).nullable(),
  packageSize: decimalStringSchema,
  isAvailable: z.boolean().default(true),
  lastScanned: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const storeProductCreateSchema = storeProductSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ─── PantryItem (Phase 3) ─────────────────────────────────────────────────────

export const pantryItemSchema = z.object({
  id: uuidSchema,
  userId: z.string().min(1),
  ingredientId: uuidSchema,
  amount: decimalStringSchema,
  unit: z.string().max(50).nullable(),
  expiresAt: z.coerce.date().nullable(),
  updatedAt: timestampSchema,
});

export const pantryItemCreateSchema = pantryItemSchema.omit({ id: true, updatedAt: true });

// ─── ShoppingList (Phase 3) ───────────────────────────────────────────────────

export const shoppingListSchema = z.object({
  id: uuidSchema,
  userId: z.string().min(1),
  name: z.string().min(1).max(255).default('Einkaufsliste'),
  isCompleted: z.boolean().default(false),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const shoppingListCreateSchema = shoppingListSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const shoppingListItemSchema = z.object({
  id: uuidSchema,
  shoppingListId: uuidSchema,
  ingredientId: uuidSchema.nullable(),
  storeProductId: uuidSchema.nullable(),
  name: z.string().min(1),
  amount: decimalStringSchema,
  unit: z.string().max(50).nullable(),
  isChecked: z.boolean().default(false),
  order: z.number().int().nullable(),
});

export const shoppingListItemCreateSchema = shoppingListItemSchema.omit({ id: true });

// ─── RecipeFavorite (Phase 2) ─────────────────────────────────────────────────

export const recipeFavoriteSchema = z.object({
  userId: z.string().min(1),
  recipeId: uuidSchema,
  createdAt: timestampSchema,
});

// ─── OcrImport (Phase 1) ──────────────────────────────────────────────────────

export const ocrImportSchema = z.object({
  id: uuidSchema,
  recipeId: uuidSchema.nullable(),
  imageUrl: z.string().min(1),
  rawText: z.string().nullable(),
  parsedData: z.unknown().nullable(),
  status: ocrStatusSchema,
  errorMessage: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const ocrImportCreateSchema = z.object({
  imageUrl: z.string().min(1),
});

export const ocrImportUpdateSchema = z.object({
  recipeId: uuidSchema.optional(),
  rawText: z.string().optional(),
  parsedData: z.unknown().optional(),
  status: ocrStatusSchema.optional(),
  errorMessage: z.string().optional(),
});
