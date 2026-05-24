import type { APIRoute } from 'astro';
import { createOcrImport, updateOcrImport } from '@/lib/db/queries';
import { extractRecipeFromImage } from '@/lib/ocr';
import { saveOcrRecipe } from '@/lib/ocr/save';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']);
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export const POST: APIRoute = async ({ request }) => {
  let ocrImportId: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) return json({ error: 'No image file provided' }, 400);
    if (!ALLOWED_TYPES.has(file.type)) return json({ error: 'Invalid file type. Allowed: jpg, png, webp, heic' }, 400);
    if (file.size > MAX_SIZE) return json({ error: 'File too large. Maximum 10 MB allowed' }, 400);

    const buffer = Buffer.from(await file.arrayBuffer());

    // Track the import (imageUrl not stored — we only process in memory)
    const ocrImport = await createOcrImport('');
    ocrImportId = ocrImport.id;
    await updateOcrImport(ocrImportId, { status: 'processing' });

    const extracted = await extractRecipeFromImage(buffer, file.type);
    const recipe = await saveOcrRecipe(extracted, ocrImportId);

    return json({ success: true, recipe });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ocr] error:', err);
    if (ocrImportId) {
      await updateOcrImport(ocrImportId, { status: 'error', errorMessage: message }).catch(() => {});
    }
    return json({ error: message }, 500);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
