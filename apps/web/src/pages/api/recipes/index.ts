import type { APIRoute } from 'astro';
import { saveRecipeToFile } from '@/lib/content/save-recipe';

interface RecipeInput {
  title: string;
  description?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  ingredients: Array<{ name: string; amount: string; unit: string }>;
  instructions?: string;
  imageUrl?: string;
}

export const POST: APIRoute = async ({ request }) => {
  if (!import.meta.env.DEV) return json({ error: 'Not found' }, 404);
  const body = await request.json() as RecipeInput;

  if (!body.title?.trim()) return json({ error: 'Title is required' }, 400);

  const steps = body.instructions?.trim()
    ? [{ order: 1, text: body.instructions.trim() }]
    : [];

  const recipe = saveRecipeToFile({
    title: body.title.trim(),
    description: body.description?.trim() || undefined,
    servings: body.servings ?? undefined,
    prepTime: body.prepTimeMinutes ?? undefined,
    cookTime: body.cookTimeMinutes ?? undefined,
    image: body.imageUrl || undefined,
    ingredients: body.ingredients
      .filter(ing => ing.name?.trim())
      .map(ing => ({
        name: ing.name.trim(),
        amount: ing.amount || undefined,
        unit: ing.unit || undefined,
      })),
    steps,
  });

  return json({ success: true, slug: recipe.slug });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
