import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const TAG = 'ocr';
const SKIP_IF_HAS = 'Samsung Food Import';
const CONTENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../content/recipes');

function addTagToFrontmatter(content: string): string | null {
  if (content.includes(`"${TAG}"`)) return null; // already present
  if (content.includes(`"${SKIP_IF_HAS}"`)) return null; // Samsung import, skip

  if (/^tags:\n\s+\[\]/m.test(content)) {
    return content.replace(/^(tags:\n)\s+\[\]/m, `$1  - "${TAG}"`);
  }

  if (/^tags:\n(?:  - [^\n]+\n)/m.test(content)) {
    return content.replace(
      /^(tags:\n(?:  - [^\n]+\n)+)/m,
      `$1  - "${TAG}"\n`
    );
  }

  return null;
}

const files = readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
console.log(`Found ${files.length} recipe files`);

let updated = 0;
let skipped = 0;

for (const file of files) {
  const filePath = resolve(CONTENT_DIR, file);
  const original = readFileSync(filePath, 'utf-8');
  const patched = addTagToFrontmatter(original);

  if (!patched) {
    skipped++;
    continue;
  }

  writeFileSync(filePath, patched, 'utf-8');
  console.log(`  Updated: ${file}`);
  updated++;
}

console.log(`\nDone — ${updated} updated, ${skipped} skipped`);
