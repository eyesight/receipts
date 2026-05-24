import { z } from "zod";

export const ingredientSchema = z.object({
  name: z.string().min(1, "Ingredient name is required"),
  amount: z.string().optional(),
  unit: z.string().optional(),
});

export const recipeStepSchema = z.object({
  order: z.number().int().positive(),
  text: z.string().min(1, "Step text is required"),
  imageUrl: z.string().url().optional(),
});

export const recipeImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

export const slugSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens");

export const recipeSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, "Title is required").max(255),
  slug: slugSchema,
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().min(1).max(50)).default([]),
  servings: z.number().int().positive().optional(),
  prepTime: z.number().int().nonnegative().optional(),
  cookTime: z.number().int().nonnegative().optional(),
  ingredients: z.array(ingredientSchema).min(1, "At least one ingredient is required"),
  steps: z.array(recipeStepSchema).min(1, "At least one step is required"),
  images: z.array(recipeImageSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const recipeCreateSchema = recipeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const recipeUpdateSchema = recipeCreateSchema.partial();
