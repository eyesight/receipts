import type { z } from "zod";
import type {
  ingredientSchema,
  recipeStepSchema,
  recipeImageSchema,
  recipeSchema,
  recipeCreateSchema,
  recipeUpdateSchema,
} from "../schemas/recipe.js";

export type Ingredient = z.infer<typeof ingredientSchema>;
export type RecipeStep = z.infer<typeof recipeStepSchema>;
export type RecipeImage = z.infer<typeof recipeImageSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type RecipeCreate = z.infer<typeof recipeCreateSchema>;
export type RecipeUpdate = z.infer<typeof recipeUpdateSchema>;
