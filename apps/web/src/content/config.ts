import { defineCollection, z } from "astro:content";
import { ingredientSchema, recipeStepSchema, recipeImageSchema } from "@recipes/shared";

const recipes = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    category: z.string().max(100).optional(),
    tags: z.array(z.string()).default([]),
    servings: z.number().int().positive().optional(),
    prepTime: z.number().int().nonnegative().optional(),
    cookTime: z.number().int().nonnegative().optional(),
    ingredients: z.array(ingredientSchema),
    steps: z.array(recipeStepSchema),
    images: z.array(recipeImageSchema).default([]),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  }),
});

export const collections = { recipes };
