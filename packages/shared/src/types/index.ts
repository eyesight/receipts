import type { z } from 'zod';
import type {
  categorySchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  tagSchema,
  tagCreateSchema,
  tagUpdateSchema,
  ingredientDbSchema,
  ingredientDbCreateSchema,
  ingredientDbUpdateSchema,
  ingredientSeasonSchema,
  ingredientSeasonCreateSchema,
  recipeDbSchema,
  recipeDbCreateSchema,
  recipeDbUpdateSchema,
  recipeIngredientSchema,
  recipeIngredientCreateSchema,
  recipeStepDbSchema,
  recipeStepDbCreateSchema,
  recipeTagSchema,
  storeProductSchema,
  storeProductCreateSchema,
  pantryItemSchema,
  pantryItemCreateSchema,
  shoppingListSchema,
  shoppingListCreateSchema,
  shoppingListItemSchema,
  shoppingListItemCreateSchema,
  recipeFavoriteSchema,
  ocrImportSchema,
  ocrImportCreateSchema,
  ocrImportUpdateSchema,
  tagTypeSchema,
  difficultySchema,
  sourceTypeSchema,
  storeSchema,
  ocrStatusSchema,
} from '../schemas/index.js';

// Re-export legacy OCR/input types for backwards compatibility
export type { Ingredient, RecipeStep, RecipeImage, Recipe, RecipeCreate, RecipeUpdate } from './recipe.js';

// ─── Enum types ───────────────────────────────────────────────────────────────

export type TagType = z.infer<typeof tagTypeSchema>;
export type Difficulty = z.infer<typeof difficultySchema>;
export type SourceType = z.infer<typeof sourceTypeSchema>;
export type Store = z.infer<typeof storeSchema>;
export type OcrStatus = z.infer<typeof ocrStatusSchema>;

// ─── DB model types ───────────────────────────────────────────────────────────

export type Category = z.infer<typeof categorySchema>;
export type CategoryCreate = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdate = z.infer<typeof categoryUpdateSchema>;

export type Tag = z.infer<typeof tagSchema>;
export type TagCreate = z.infer<typeof tagCreateSchema>;
export type TagUpdate = z.infer<typeof tagUpdateSchema>;

export type IngredientDb = z.infer<typeof ingredientDbSchema>;
export type IngredientDbCreate = z.infer<typeof ingredientDbCreateSchema>;
export type IngredientDbUpdate = z.infer<typeof ingredientDbUpdateSchema>;

export type IngredientSeason = z.infer<typeof ingredientSeasonSchema>;
export type IngredientSeasonCreate = z.infer<typeof ingredientSeasonCreateSchema>;

export type RecipeDb = z.infer<typeof recipeDbSchema>;
export type RecipeDbCreate = z.infer<typeof recipeDbCreateSchema>;
export type RecipeDbUpdate = z.infer<typeof recipeDbUpdateSchema>;

export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>;
export type RecipeIngredientCreate = z.infer<typeof recipeIngredientCreateSchema>;

export type RecipeStepDb = z.infer<typeof recipeStepDbSchema>;
export type RecipeStepDbCreate = z.infer<typeof recipeStepDbCreateSchema>;

export type RecipeTag = z.infer<typeof recipeTagSchema>;

export type StoreProduct = z.infer<typeof storeProductSchema>;
export type StoreProductCreate = z.infer<typeof storeProductCreateSchema>;

export type PantryItem = z.infer<typeof pantryItemSchema>;
export type PantryItemCreate = z.infer<typeof pantryItemCreateSchema>;

export type ShoppingList = z.infer<typeof shoppingListSchema>;
export type ShoppingListCreate = z.infer<typeof shoppingListCreateSchema>;

export type ShoppingListItem = z.infer<typeof shoppingListItemSchema>;
export type ShoppingListItemCreate = z.infer<typeof shoppingListItemCreateSchema>;

export type RecipeFavorite = z.infer<typeof recipeFavoriteSchema>;

export type OcrImport = z.infer<typeof ocrImportSchema>;
export type OcrImportCreate = z.infer<typeof ocrImportCreateSchema>;
export type OcrImportUpdate = z.infer<typeof ocrImportUpdateSchema>;

// ─── Composed / rich types ────────────────────────────────────────────────────

export type RecipeWithRelations = RecipeDb & {
  category: Category | null;
  recipeIngredients: Array<RecipeIngredient & { ingredient: IngredientDb }>;
  recipeSteps: RecipeStepDb[];
  tags: Tag[];
};

export type RecipeSummary = Pick<
  RecipeDb,
  | 'id'
  | 'title'
  | 'slug'
  | 'description'
  | 'imageUrl'
  | 'servings'
  | 'totalTime'
  | 'difficulty'
  | 'rating'
  | 'viewCount'
  | 'isPublished'
  | 'createdAt'
> & { category: Category | null; tags: Tag[] };
