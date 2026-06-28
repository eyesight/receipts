import type { APIRoute } from 'astro';
import { extractRecipeFromImage } from '@/lib/ocr';
import { saveRecipeToFile } from '@/lib/content/save-recipe';

const MAX_SIZE = 10 * 1024 * 1024;

function detectMimeType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  // WebP  (RIFF????WEBP)
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
  // HEIC/HEIF  (????ftyp)
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return 'image/heic';
  return null;
}

export const POST: APIRoute = async ({ request }) => {
  if (!import.meta.env.DEV) return json({ error: 'Not found' }, 404);
  try {
    const buffer = Buffer.from(await request.arrayBuffer());

    if (buffer.length === 0) return json({ error: 'No image received' }, 400);
    if (buffer.length > MAX_SIZE) return json({ error: 'File too large. Maximum 10 MB allowed' }, 400);

    const mimeType = detectMimeType(buffer);
    if (!mimeType) return json({ error: 'Unrecognised image format. Supported: JPEG, PNG, WebP, HEIC' }, 400);

    const extracted = await extractRecipeFromImage(buffer, mimeType);

    const recipe = saveRecipeToFile({
      title: extracted.title,
      description: extracted.description,
      category: extracted.category,
      tags: ['ocr', ...extracted.tags],
      servings: extracted.servings,
      prepTime: extracted.prepTime,
      cookTime: extracted.cookTime,
      difficulty: extracted.difficulty,
      ingredients: extracted.ingredients.map(ing => ({
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        note: ing.note,
        isOptional: ing.isOptional,
        group: ing.group,
      })),
      steps: extracted.steps.map(step => ({
        order: step.order,
        text: step.description,
        title: step.title,
        tip: step.tip,
        duration: step.duration,
      })),
    });

    return json({ success: true, recipe });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ocr] error:', err);
    return json({ error: message }, 500);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
