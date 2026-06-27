import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  decimal,
  date,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ─── Custom column types ──────────────────────────────────────────────────────

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

// Phase 3: uncomment when pgvector extension is enabled
// const vector = customType<{ data: number[]; driverData: string; config: { dimensions: number } }>({
//   dataType(config) { return `vector(${config?.dimensions ?? 1536})`; },
//   toDriver(value: number[]) { return `[${value.join(',')}]`; },
//   fromDriver(value: string) { return value.replace(/^\[|\]$/g, '').split(',').map(Number); },
// });

// ─── Enums ────────────────────────────────────────────────────────────────────

export const tagTypeEnum = pgEnum('tag_type', ['diet', 'cuisine', 'occasion', 'general']);
export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard']);
export const sourceTypeEnum = pgEnum('source_type', ['ocr', 'manual', 'import']);
export const storeEnum = pgEnum('store', ['coop', 'migros', 'aldi', 'lidl', 'other']);
export const ocrStatusEnum = pgEnum('ocr_status', ['pending', 'processing', 'done', 'error']);

// ─── Core tables ──────────────────────────────────────────────────────────────

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 100 }).unique().notNull(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  description: text('description'),
  imageUrl: varchar('image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 100 }).unique().notNull(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  type: tagTypeEnum('type').notNull(),
});

export const ingredients = pgTable('ingredients', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 100 }).unique().notNull(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  unit: varchar('unit', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const ingredientSeasons = pgTable(
  'ingredient_seasons',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    ingredientId: uuid('ingredient_id')
      .notNull()
      .references(() => ingredients.id, { onDelete: 'cascade' }),
    month: integer('month').notNull(),
    region: varchar('region', { length: 10 }).default('CH').notNull(),
  },
  (table) => [
    uniqueIndex('ingredient_seasons_unique').on(table.ingredientId, table.month, table.region),
    index('ingredient_seasons_month_idx').on(table.month),
  ]
);

export const recipes = pgTable(
  'recipes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).unique().notNull(),
    description: text('description'),
    servings: integer('servings').default(4),
    prepTime: integer('prep_time'),
    cookTime: integer('cook_time'),
    totalTime: integer('total_time'),
    difficulty: difficultyEnum('difficulty'),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    imageUrl: varchar('image_url'),
    source: varchar('source'),
    sourceType: sourceTypeEnum('source_type').default('manual').notNull(),
    createdBy: varchar('created_by'),
    isPublished: boolean('is_published').default(false).notNull(),
    viewCount: integer('view_count').default(0).notNull(),
    favoriteCount: integer('favorite_count').default(0).notNull(),
    rating: decimal('rating', { precision: 3, scale: 2 }),
    ratingCount: integer('rating_count').default(0).notNull(),
    searchVector: tsvector('search_vector'),
    // Phase 3: add after running: CREATE EXTENSION vector;
    // embedding: vector('embedding', { dimensions: 1536 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('recipes_slug_idx').on(table.slug),
    index('recipes_created_by_idx').on(table.createdBy),
    index('recipes_category_id_idx').on(table.categoryId),
    index('recipes_is_published_idx').on(table.isPublished),
    index('recipes_difficulty_idx').on(table.difficulty),
    index('recipes_total_time_idx').on(table.totalTime),
    index('recipes_rating_idx').on(table.rating),
    index('recipes_view_count_idx').on(table.viewCount),
    index('recipes_search_vector_idx').using('gin', table.searchVector),
    // Phase 3: index('recipes_embedding_idx').using('ivfflat', table.embedding),
  ]
);

export const recipeIngredients = pgTable(
  'recipe_ingredients',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    ingredientId: uuid('ingredient_id')
      .notNull()
      .references(() => ingredients.id),
    amount: decimal('amount', { precision: 10, scale: 2 }),
    unit: varchar('unit', { length: 50 }),
    note: varchar('note', { length: 255 }),
    isOptional: boolean('is_optional').default(false).notNull(),
    order: integer('order').notNull(),
    group: varchar('group', { length: 100 }),
  },
  (table) => [index('recipe_ingredients_recipe_id_idx').on(table.recipeId)]
);

export const recipeSteps = pgTable(
  'recipe_steps',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    order: integer('order').notNull(),
    title: varchar('title', { length: 255 }),
    description: text('description').notNull(),
    duration: integer('duration'),
    imageUrl: varchar('image_url'),
    tip: text('tip'),
  },
  (table) => [index('recipe_steps_recipe_id_idx').on(table.recipeId)]
);

export const recipeTags = pgTable(
  'recipe_tags',
  {
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    source: sourceTypeEnum('source').notNull().default('manual'),
  },
  (table) => [primaryKey({ columns: [table.recipeId, table.tagId] })]
);

// ─── Future tables ────────────────────────────────────────────────────────────

// Phase 3: Coop/Migros price bot
export const storeProducts = pgTable(
  'store_products',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    ingredientId: uuid('ingredient_id').references(() => ingredients.id),
    store: storeEnum('store').notNull(),
    productName: varchar('product_name').notNull(),
    productUrl: varchar('product_url'),
    price: decimal('price', { precision: 10, scale: 2 }),
    pricePerUnit: decimal('price_per_unit', { precision: 10, scale: 2 }),
    unit: varchar('unit', { length: 50 }),
    packageSize: decimal('package_size', { precision: 10, scale: 2 }),
    isAvailable: boolean('is_available').default(true).notNull(),
    lastScanned: timestamp('last_scanned'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('store_products_ingredient_id_idx').on(table.ingredientId)]
);

// Phase 3: Pantry / Vorrat
export const pantryItems = pgTable(
  'pantry_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    ingredientId: uuid('ingredient_id')
      .notNull()
      .references(() => ingredients.id),
    amount: decimal('amount', { precision: 10, scale: 2 }),
    unit: varchar('unit', { length: 50 }),
    expiresAt: date('expires_at'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('pantry_items_unique').on(table.userId, table.ingredientId),
    index('pantry_items_user_id_idx').on(table.userId),
  ]
);

// Phase 3: Einkaufsliste
export const shoppingLists = pgTable('shopping_lists', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull(),
  name: varchar('name', { length: 255 }).default('Einkaufsliste').notNull(),
  isCompleted: boolean('is_completed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const shoppingListItems = pgTable(
  'shopping_list_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    shoppingListId: uuid('shopping_list_id')
      .notNull()
      .references(() => shoppingLists.id, { onDelete: 'cascade' }),
    ingredientId: uuid('ingredient_id').references(() => ingredients.id),
    storeProductId: uuid('store_product_id').references(() => storeProducts.id),
    name: varchar('name').notNull(),
    amount: decimal('amount', { precision: 10, scale: 2 }),
    unit: varchar('unit', { length: 50 }),
    isChecked: boolean('is_checked').default(false).notNull(),
    order: integer('order'),
  },
  (table) => [index('shopping_list_items_list_id_idx').on(table.shoppingListId)]
);

// Phase 2: Favoriten
export const recipeFavorites = pgTable(
  'recipe_favorites',
  {
    userId: varchar('user_id').notNull(),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.recipeId] })]
);

// Phase 1: OCR import tracking
export const ocrImports = pgTable('ocr_imports', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  recipeId: uuid('recipe_id').references(() => recipes.id),
  imageUrl: varchar('image_url').notNull(),
  rawText: text('raw_text'),
  parsedData: jsonb('parsed_data'),
  status: ocrStatusEnum('status').default('pending').notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const categoriesRelations = relations(categories, ({ many }) => ({
  recipes: many(recipes),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  recipeTags: many(recipeTags),
}));

export const ingredientsRelations = relations(ingredients, ({ many }) => ({
  seasons: many(ingredientSeasons),
  recipeIngredients: many(recipeIngredients),
  pantryItems: many(pantryItems),
  shoppingListItems: many(shoppingListItems),
}));

export const ingredientSeasonsRelations = relations(ingredientSeasons, ({ one }) => ({
  ingredient: one(ingredients, {
    fields: [ingredientSeasons.ingredientId],
    references: [ingredients.id],
  }),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  category: one(categories, {
    fields: [recipes.categoryId],
    references: [categories.id],
  }),
  recipeIngredients: many(recipeIngredients),
  recipeSteps: many(recipeSteps),
  recipeTags: many(recipeTags),
  recipeFavorites: many(recipeFavorites),
  ocrImports: many(ocrImports),
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeIngredients.recipeId],
    references: [recipes.id],
  }),
  ingredient: one(ingredients, {
    fields: [recipeIngredients.ingredientId],
    references: [ingredients.id],
  }),
}));

export const recipeStepsRelations = relations(recipeSteps, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeSteps.recipeId],
    references: [recipes.id],
  }),
}));

export const recipeTagsRelations = relations(recipeTags, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeTags.recipeId],
    references: [recipes.id],
  }),
  tag: one(tags, {
    fields: [recipeTags.tagId],
    references: [tags.id],
  }),
}));

export const storeProductsRelations = relations(storeProducts, ({ one, many }) => ({
  ingredient: one(ingredients, {
    fields: [storeProducts.ingredientId],
    references: [ingredients.id],
  }),
  shoppingListItems: many(shoppingListItems),
}));

export const pantryItemsRelations = relations(pantryItems, ({ one }) => ({
  ingredient: one(ingredients, {
    fields: [pantryItems.ingredientId],
    references: [ingredients.id],
  }),
}));

export const shoppingListsRelations = relations(shoppingLists, ({ many }) => ({
  items: many(shoppingListItems),
}));

export const shoppingListItemsRelations = relations(shoppingListItems, ({ one }) => ({
  shoppingList: one(shoppingLists, {
    fields: [shoppingListItems.shoppingListId],
    references: [shoppingLists.id],
  }),
  ingredient: one(ingredients, {
    fields: [shoppingListItems.ingredientId],
    references: [ingredients.id],
  }),
  storeProduct: one(storeProducts, {
    fields: [shoppingListItems.storeProductId],
    references: [storeProducts.id],
  }),
}));

export const recipeFavoritesRelations = relations(recipeFavorites, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeFavorites.recipeId],
    references: [recipes.id],
  }),
}));

export const ocrImportsRelations = relations(ocrImports, ({ one }) => ({
  recipe: one(recipes, {
    fields: [ocrImports.recipeId],
    references: [recipes.id],
  }),
}));

// ─── Inferred types ───────────────────────────────────────────────────────────

export type Category = typeof categories.$inferSelect;
export type CategoryInsert = typeof categories.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type TagInsert = typeof tags.$inferInsert;

export type Ingredient = typeof ingredients.$inferSelect;
export type IngredientInsert = typeof ingredients.$inferInsert;

export type IngredientSeason = typeof ingredientSeasons.$inferSelect;
export type IngredientSeasonInsert = typeof ingredientSeasons.$inferInsert;

export type Recipe = typeof recipes.$inferSelect;
export type RecipeInsert = typeof recipes.$inferInsert;

export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type RecipeIngredientInsert = typeof recipeIngredients.$inferInsert;

export type RecipeStep = typeof recipeSteps.$inferSelect;
export type RecipeStepInsert = typeof recipeSteps.$inferInsert;

export type RecipeTag = typeof recipeTags.$inferSelect;

export type StoreProduct = typeof storeProducts.$inferSelect;
export type StoreProductInsert = typeof storeProducts.$inferInsert;

export type PantryItem = typeof pantryItems.$inferSelect;
export type PantryItemInsert = typeof pantryItems.$inferInsert;

export type ShoppingList = typeof shoppingLists.$inferSelect;
export type ShoppingListInsert = typeof shoppingLists.$inferInsert;

export type ShoppingListItem = typeof shoppingListItems.$inferSelect;
export type ShoppingListItemInsert = typeof shoppingListItems.$inferInsert;

export type RecipeFavorite = typeof recipeFavorites.$inferSelect;

export type OcrImport = typeof ocrImports.$inferSelect;
export type OcrImportInsert = typeof ocrImports.$inferInsert;
