import 'dotenv/config';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { recipes } from '../../lib/db/schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const INPUT_FILE = join(DATA_DIR, 'recipes-raw.json');
const IMAGES_DIR = join(__dirname, '../../../public/images/recipes');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCdnUrl(recipe: Record<string, unknown>): string | null {
  // Always prefer the preserved original CDN URL
  if (typeof recipe._cdnImageUrl === 'string') return recipe._cdnImageUrl;
  const img = recipe.image;
  if (typeof img === 'string' && img.startsWith('http')) return img;
  if (typeof img === 'object' && img !== null && 'url' in img) {
    const u = (img as { url: string }).url;
    if (u.startsWith('http')) return u;
  }
  return null;
}

function localPathOnDisk(id: string): string | null {
  for (const ext of ['jpg', 'png', 'webp', 'avif']) {
    if (existsSync(join(IMAGES_DIR, `${id}.${ext}`))) {
      return `/images/recipes/${id}.${ext}`;
    }
  }
  return null;
}

function inferExtension(url: string, contentType: string): string {
  const urlExt = extname(new URL(url).pathname).replace('.', '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(urlExt)) {
    return urlExt === 'jpeg' ? 'jpg' : urlExt;
  }
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  return 'jpg';
}

async function downloadImage(id: string, cdnUrl: string): Promise<string | null> {
  const response = await fetch(cdnUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; recipe-importer/1.0)' },
  });

  if (!response.ok) {
    console.error(`  HTTP ${response.status} for ${cdnUrl}`);
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const ext = inferExtension(cdnUrl, contentType);
  const dest = join(IMAGES_DIR, `${id}.${ext}`);

  if (response.body) {
    await pipeline(
      Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
      createWriteStream(dest)
    );
  } else {
    writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
  }

  // Confirm file was actually written
  if (!existsSync(dest)) throw new Error(`File not written: ${dest}`);

  return `/images/recipes/${id}.${ext}`;
}

async function main() {
  if (!existsSync(INPUT_FILE)) {
    console.error(`${INPUT_FILE} not found — run import:fetch first`);
    await client.end();
    process.exit(1);
  }

  mkdirSync(IMAGES_DIR, { recursive: true });

  const rawRecipes: Record<string, unknown>[] = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));
  let downloaded = 0;
  let dbUpdated = 0;

  for (let i = 0; i < rawRecipes.length; i++) {
    const recipe = rawRecipes[i];
    const id = recipe._id as string;
    const sourceUrl = recipe._sourceUrl as string;

    const cdnUrl = getCdnUrl(recipe);
    if (!cdnUrl) continue;

    // Preserve the original CDN URL before we overwrite image
    if (!recipe._cdnImageUrl) {
      recipe._cdnImageUrl = cdnUrl;
    }

    // Check if already on disk
    let localPath = localPathOnDisk(id);

    if (!localPath) {
      try {
        localPath = await downloadImage(id, cdnUrl);
        if (localPath) {
          downloaded++;
          console.log(`Downloaded ${downloaded}: ${recipe.name ?? id}`);
        }
      } catch (err) {
        console.error(`Failed ${id}:`, err instanceof Error ? err.message : err);
        // Save progress so far (with _cdnImageUrl preserved) before continuing
        writeFileSync(INPUT_FILE, JSON.stringify(rawRecipes, null, 2));
        if (i < rawRecipes.length - 1) await delay(300);
        continue;
      }

      if (i < rawRecipes.length - 1) await delay(300);
    }

    if (!localPath) continue;

    // Only update image field after file is confirmed on disk
    recipe.image = localPath;
    writeFileSync(INPUT_FILE, JSON.stringify(rawRecipes, null, 2));

    // Update DB
    try {
      await db.update(recipes).set({ imageUrl: localPath }).where(eq(recipes.source, sourceUrl));
      dbUpdated++;
    } catch (err) {
      console.error(`DB update failed for ${id}:`, err instanceof Error ? err.message : err);
    }
  }

  writeFileSync(INPUT_FILE, JSON.stringify(rawRecipes, null, 2));
  console.log(`Done. Downloaded: ${downloaded}, DB records updated: ${dbUpdated}`);
  await client.end();
}

main().catch(async (err) => {
  console.error('Download failed:', err);
  await client.end();
  process.exit(1);
});
