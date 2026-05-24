import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { load } from 'cheerio';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const URLS_FILE = join(DATA_DIR, 'recipe-urls.json');
const OUTPUT_FILE = join(DATA_DIR, 'recipes-raw.json');

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractId(url: string): string {
  const match = url.match(/\/recipes\/([^/?#]+)/);
  return match ? match[1] : url;
}

interface RecipeJsonLd {
  '@context': string;
  '@type': string;
  name: string;
  description?: string;
  image?: string | { url: string };
  recipeYield?: number | number[] | string;
  totalTime?: string;
  prepTime?: string;
  cookTime?: string;
  recipeIngredient?: string[];
  recipeInstructions?: unknown[];
  nutrition?: Record<string, string>;
  recipeCategory?: string;
  recipeCuisine?: string;
  keywords?: string;
  aggregateRating?: Record<string, unknown>;
  author?: Record<string, unknown>;
  inLanguage?: string;
  // Added by us
  _sourceUrl: string;
  _id: string;
  _fetchedAt: string;
}

function extractGrpcDurations(html: string): { cookTime?: number; prepTime?: number } {
  // The page embeds gRPC response cache as JSON in a script tag
  // Try to find durations:{cookTime:N,prepTime:N}
  const m = html.match(/"durations"\s*:\s*\{[^}]*"cookTime"\s*:\s*(\d+)[^}]*"prepTime"\s*:\s*(\d+)[^}]*\}/);
  if (m) return { cookTime: parseInt(m[1]), prepTime: parseInt(m[2]) };

  const m2 = html.match(/"durations"\s*:\s*\{[^}]*"prepTime"\s*:\s*(\d+)[^}]*"cookTime"\s*:\s*(\d+)[^}]*\}/);
  if (m2) return { cookTime: parseInt(m2[2]), prepTime: parseInt(m2[1]) };

  return {};
}

async function fetchRecipe(url: string): Promise<RecipeJsonLd> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; recipe-importer/1.0)' },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const html = await response.text();
  const $ = load(html);

  // Extract all JSON-LD script blocks
  let recipe: RecipeJsonLd | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    if (recipe !== null) return;
    try {
      const data = JSON.parse($(el).text()) as Record<string, unknown>;
      if (data['@type'] === 'Recipe') {
        recipe = data as unknown as RecipeJsonLd;
      }
    } catch {
      // malformed, skip
    }
  });

  if (recipe === null) {
    throw new Error(`No schema.org Recipe found at ${url}`);
  }

  const r = recipe as RecipeJsonLd;

  // Supplement with durations from gRPC cache if missing
  const durations = extractGrpcDurations(html);
  if (durations.cookTime && !r.cookTime) {
    r.cookTime = `PT${durations.cookTime}M`;
  }
  if (durations.prepTime && !r.prepTime) {
    r.prepTime = `PT${durations.prepTime}M`;
  }

  r._sourceUrl = url;
  r._id = extractId(url);
  r._fetchedAt = new Date().toISOString();

  return r;
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  if (!existsSync(URLS_FILE)) {
    console.error(`${URLS_FILE} not found — run import:crawl first`);
    process.exit(1);
  }

  const urls: string[] = JSON.parse(readFileSync(URLS_FILE, 'utf-8'));

  const existing = new Map<string, RecipeJsonLd>();
  if (existsSync(OUTPUT_FILE)) {
    const arr: RecipeJsonLd[] = JSON.parse(readFileSync(OUTPUT_FILE, 'utf-8'));
    for (const r of arr) existing.set(r._id, r);
    console.log(`Resuming: ${existing.size} already fetched`);
  }

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const id = extractId(url);

    if (existing.has(id)) {
      continue;
    }

    try {
      const recipe = await fetchRecipe(url);
      existing.set(id, recipe);
      writeFileSync(OUTPUT_FILE, JSON.stringify(Array.from(existing.values()), null, 2));
      console.log(`Fetched ${existing.size}/${urls.length}: ${recipe.name}`);
    } catch (err) {
      console.error(`Failed ${url}:`, err instanceof Error ? err.message : err);
    }

    if (i < urls.length - 1) {
      await delay(1000);
    }
  }

  console.log(`Done. ${existing.size} recipes in ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error('Fetch failed:', err);
  process.exit(1);
});
