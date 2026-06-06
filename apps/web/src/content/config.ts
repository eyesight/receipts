import { defineCollection, z } from "astro:content";
import { ingredientSchema, recipeStepSchema, recipeImageSchema } from "@recipes/shared";

// Extended locally to capture all DB fields in the markdown template.
const contentIngredientSchema = ingredientSchema.extend({
  note: z.string().optional(),
  isOptional: z.boolean().default(false),
  group: z.string().optional(),
});

const contentStepSchema = recipeStepSchema.extend({
  title: z.string().optional(),
  tip: z.string().optional(),
  duration: z.number().int().nonnegative().optional(),
});

const recipes = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    category: z.string().max(100).optional(),
    tags: z.array(z.string()).default([]),
    servings: z.number().int().positive().optional(),
    prepTime: z.number().int().nonnegative().optional(),
    cookTime: z.number().int().nonnegative().optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    image: z.string().optional(),
    ingredients: z.array(contentIngredientSchema),
    steps: z.array(contentStepSchema),
    images: z.array(recipeImageSchema).default([]),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  }),
});

export const collections = { recipes };
