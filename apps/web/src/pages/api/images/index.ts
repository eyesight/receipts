import type { APIRoute } from 'astro';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};
const MAX_SIZE = 10 * 1024 * 1024;

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData();
  const file = formData.get('image') as File | null;

  if (!file) return json({ error: 'Kein Bild angegeben' }, 400);
  if (!(file.type in ALLOWED)) return json({ error: 'Ungültiger Dateityp. Erlaubt: JPG, PNG, WebP, HEIC' }, 400);
  if (file.size > MAX_SIZE) return json({ error: 'Datei zu groß. Max. 10 MB' }, 400);

  const ext = ALLOWED[file.type];
  const filename = `${randomUUID()}.${ext}`;
  const dir = join(process.cwd(), 'public', 'images', 'recipes');

  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), Buffer.from(await file.arrayBuffer()));

  return json({ url: `/images/recipes/${filename}` });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
