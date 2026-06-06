import { defineCollection, z } from "astro:content";
import { recipeImageSchema } from "@recipes/shared";

// Coerce YAML null → undefined and numbers → string for amount fields.
const str = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => (v != null ? String(v) : undefined));

const num = z
  .number()
  .nullish()
  .transform((v) => v ?? undefined);

const contentIngredientSchema = z.object({
  name: z.string().min(1),
  amount: str,
  unit: str,
  note: str,
  isOptional: z.boolean().default(false),
  group: str,
});

const contentStepSchema = z.object({
  order: z.number().int().positive(),
  text: z.string().min(1),
  imageUrl: str,
  title: str,
  tip: str,
  duration: num,
});

const recipes = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string().min(1).max(255),
    description: str,
    category: str,
    tags: z.array(z.string()).default([]),
    servings: num,
    prepTime: num,
    cookTime: num,
    difficulty: z
      .enum(["easy", "medium", "hard"])
      .nullish()
      .transform((v) => v ?? undefined),
    image: str,
    ingredients: z.array(contentIngredientSchema),
    steps: z.array(contentStepSchema),
    images: z.array(recipeImageSchema).default([]),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  }),
});

export const collections = { recipes };
