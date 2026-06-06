import type { APIRoute } from 'astro';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const MAX_SIZE = 10 * 1024 * 1024;

function detectMimeType(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF)
    return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47)
    return { mime: 'image/png', ext: 'png' };
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50)
    return { mime: 'image/webp', ext: 'webp' };
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70)
    return { mime: 'image/heic', ext: 'heic' };
  return null;
}

export const POST: APIRoute = async ({ request }) => {
  const buffer = Buffer.from(await request.arrayBuffer());

  if (buffer.length === 0) return json({ error: 'Kein Bild empfangen' }, 400);
  if (buffer.length > MAX_SIZE) return json({ error: 'Datei zu groß. Max. 10 MB' }, 400);

  const detected = detectMimeType(buffer);
  if (!detected) return json({ error: 'Ungültiges Bildformat. Erlaubt: JPG, PNG, WebP, HEIC' }, 400);

  const filename = `${randomUUID()}.${detected.ext}`;
  const dir = join(process.cwd(), 'public', 'images', 'recipes');

  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), buffer);

  return json({ url: `/images/recipes/${filename}` });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
