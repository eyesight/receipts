import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { load } from 'cheerio';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const OUTPUT_FILE = join(DATA_DIR, 'recipe-urls.json');

const PROFILE_URL = 'https://app.samsungfood.com/profile/10243f57076a5004f1a9bd9fe77e4bd97b8';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toAbsolute(href: string): string {
  return href.startsWith('http') ? href : `https://app.samsungfood.com${href}`;
}

function extractFromNextData(html: string, urls: Set<string>) {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (!match) return;
  try {
    const data = JSON.parse(match[1]);
    const json = JSON.stringify(data);
    const recipeMatches = json.matchAll(/"slug"\s*:\s*"([^"]+)"/g);
    for (const m of recipeMatches) {
      urls.add(`https://app.samsungfood.com/recipes/${m[1]}`);
    }
    const idMatches = json.matchAll(/\/recipes\/([a-f0-9-]{8,})/g);
    for (const m of idMatches) {
      urls.add(`https://app.samsungfood.com/recipes/${m[1]}`);
    }
  } catch {
    // non-JSON, ignore
  }
}

async function crawl() {
  mkdirSync(DATA_DIR, { recursive: true });

  const existing: string[] = existsSync(OUTPUT_FILE)
    ? JSON.parse(readFileSync(OUTPUT_FILE, 'utf-8'))
    : [];
  const urls = new Set<string>(existing);

  let nextUrl: string | null = PROFILE_URL;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; recipe-importer/1.0)' },
    });

    if (!response.ok) {
      console.error(`HTTP ${response.status} for ${nextUrl}`);
      break;
    }

    const html = await response.text();
    const $ = load(html);

    // Extract recipe hrefs from anchor tags
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      if (/\/recipes\/[^/?#"]+/.test(href)) {
        urls.add(toAbsolute(href.split('?')[0]));
      }
    });

    // Also try __NEXT_DATA__ for SPAs
    extractFromNextData(html, urls);

    console.log(`Found ${urls.size} recipes so far...`);

    // Follow pagination — look for "Next" / "Next Page" links
    let foundNext = false;
    $('a[href]').each((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (text === 'next' || text === 'next page') {
        const href = $(el).attr('href') ?? '';
        nextUrl = toAbsolute(href);
        foundNext = true;
        return false; // break
      }
    });

    if (!foundNext) {
      // Also check rel="next"
      const relNext = $('a[rel="next"]').attr('href');
      if (relNext) {
        nextUrl = toAbsolute(relNext);
      } else {
        nextUrl = null;
      }
    }

    if (nextUrl) {
      await delay(1000);
    }
  }

  const urlArray = Array.from(urls);
  writeFileSync(OUTPUT_FILE, JSON.stringify(urlArray, null, 2));
  console.log(`Saved ${urlArray.length} recipe URLs to ${OUTPUT_FILE}`);
}

crawl().catch((err) => {
  console.error('Crawl failed:', err);
  process.exit(1);
});
