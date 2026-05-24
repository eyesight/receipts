import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { createOcrImport, updateOcrImport } from '@/lib/db/queries';
import { extractRecipeFromImage } from '@/lib/ocr';
import { saveOcrRecipe } from '@/lib/ocr/save';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']);
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

async function storeImage(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  if (!import.meta.env.R2_ACCESS_KEY) {
    console.warn('R2 not configured, using local storage');
    // Dynamic import keeps fs out of the Cloudflare Workers bundle
    const { writeFile, mkdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const dir = join(process.cwd(), 'public', 'uploads');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), buffer);
    return `/uploads/${filename}`;
  }

  // R2 via S3-compatible API
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = new S3Client({
    region: 'auto',
    endpoint: import.meta.env.R2_BUCKET_URL as string,
    forcePathStyle: true, // required for MinIO and R2 custom endpoints
    credentials: {
      accessKeyId: import.meta.env.R2_ACCESS_KEY as string,
      secretAccessKey: import.meta.env.R2_SECRET_KEY as string,
    },
  });
  const bucket = (import.meta.env.R2_BUCKET_NAME as string | undefined) ?? 'recipes';
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `uploads/${filename}`,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return `${import.meta.env.R2_BUCKET_URL}/${bucket}/uploads/${filename}`;
}

export const POST: APIRoute = async ({ request }) => {
  let ocrImportId: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return json({ error: 'No image file provided' }, 400);
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return json({ error: 'Invalid file type. Allowed: jpg, png, webp, heic' }, 400);
    }

    if (file.size > MAX_SIZE) {
      return json({ error: 'File too large. Maximum 10 MB allowed' }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.includes('jpeg') || file.type.includes('jpg') ? 'jpg'
      : file.type.split('/')[1];
    const filename = `${randomUUID()}.${ext}`;

    const imageUrl = await storeImage(buffer, filename, file.type);

    // Record the import immediately so we can update status on error
    const ocrImport = await createOcrImport(imageUrl);
    ocrImportId = ocrImport.id;
    await updateOcrImport(ocrImportId, { status: 'processing' });

    const extracted = await extractRecipeFromImage(buffer, file.type);
    const recipe = await saveOcrRecipe(extracted, ocrImportId, imageUrl);

    return json({ success: true, recipe });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ocr] error:', err);

    if (ocrImportId) {
      await updateOcrImport(ocrImportId, { status: 'error', errorMessage: message }).catch(
        () => {}
      );
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
