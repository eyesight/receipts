import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export interface RecipeFileData {
  title: string;
  description?: string | null;
  category?: string | null;
  tags?: string[];
  servings?: number | null;
  prepTime?: number | null;
  cookTime?: number | null;
  difficulty?: 'easy' | 'medium' | 'hard' | null;
  image?: string | null;
  ingredients: Array<{
    name: string;
    amount?: string | number | null;
    unit?: string | null;
    note?: string | null;
    isOptional?: boolean;
    group?: string | null;
  }>;
  steps: Array<{
    order: number;
    text: string;
    title?: string | null;
    tip?: string | null;
    duration?: number | null;
  }>;
}

function q(value: string | null | undefined): string {
  if (value == null || value === '') return '""';
  if (value.includes('\n')) {
    const indented = value.trimEnd().split('\n').map(l => `  ${l}`).join('\n');
    return `|\n${indented}`;
  }
  return JSON.stringify(value);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniqueSlug(base: string, contentDir: string): string {
  let slug = base || 'recipe';
  let i = 1;
  while (existsSync(join(contentDir, `${slug}.md`))) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

export function saveRecipeToFile(data: RecipeFileData): { slug: string; title: string } {
  const contentDir = join(process.cwd(), 'src', 'content', 'recipes');
  mkdirSync(contentDir, { recursive: true });

  const slug = uniqueSlug(slugify(data.title), contentDir);
  const today = new Date().toISOString().split('T')[0];
  const tags = data.tags ?? [];

  const ingredientsYaml = data.ingredients.length
    ? data.ingredients.map(ing => {
        const amt = ing.amount != null
          ? (typeof ing.amount === 'number'
              ? (ing.amount % 1 === 0 ? String(Math.floor(ing.amount)) : String(ing.amount))
              : ing.amount)
          : null;
        const parts: string[] = [];
        if (amt != null) parts.push(`  - amount: ${q(amt)}`);
        else parts.push(`  -`);
        if (ing.unit) parts.push(`    unit: ${q(ing.unit)}`);
        parts.push(`    name: ${q(ing.name)}`);
        if (ing.note) parts.push(`    note: ${q(ing.note)}`);
        if (ing.isOptional) parts.push(`    isOptional: true`);
        if (ing.group) parts.push(`    group: ${q(ing.group)}`);
        return parts.join('\n');
      }).join('\n')
    : '  []';

  const stepsYaml = data.steps.length
    ? data.steps.map(step => {
        const parts = [`  - order: ${step.order}`, `    text: ${q(step.text)}`];
        if (step.title) parts.push(`    title: ${q(step.title)}`);
        if (step.tip) parts.push(`    tip: ${q(step.tip)}`);
        if (step.duration) parts.push(`    duration: ${step.duration}`);
        return parts.join('\n');
      }).join('\n')
    : '  []';

  const tagsYaml = tags.length
    ? tags.map(t => `  - ${q(t)}`).join('\n')
    : '  []';

  const lines = [
    '---',
    `title: ${q(data.title)}`,
    ...(data.description ? [`description: ${q(data.description)}`] : []),
    ...(data.category ? [`category: ${q(data.category)}`] : []),
    `tags:`,
    tagsYaml,
    ...(data.servings != null ? [`servings: ${data.servings}`] : []),
    ...(data.prepTime != null ? [`prepTime: ${data.prepTime}`] : []),
    ...(data.cookTime != null ? [`cookTime: ${data.cookTime}`] : []),
    ...(data.difficulty != null ? [`difficulty: ${data.difficulty}`] : []),
    ...(data.image ? [`image: ${q(data.image)}`] : []),
    `ingredients:`,
    ingredientsYaml,
    `steps:`,
    stepsYaml,
    `images: []`,
    `createdAt: ${today}`,
    `updatedAt: ${today}`,
    '---',
    '',
  ].join('\n');

  writeFileSync(join(contentDir, `${slug}.md`), lines, 'utf-8');
  return { slug, title: data.title };
}

export function updateRecipeFile(slug: string, data: RecipeFileData): { slug: string; title: string } {
  const contentDir = join(process.cwd(), 'src', 'content', 'recipes');
  const filePath = join(contentDir, `${slug}.md`);

  // Preserve original createdAt
  let createdAt = new Date().toISOString().split('T')[0];
  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf-8');
    const m = existing.match(/^createdAt:\s*(.+)$/m);
    if (m) createdAt = m[1].trim();
  }

  const today = new Date().toISOString().split('T')[0];
  const tags = data.tags ?? [];

  const ingredientsYaml = data.ingredients.length
    ? data.ingredients.map(ing => {
        const amt = ing.amount != null
          ? (typeof ing.amount === 'number'
              ? (ing.amount % 1 === 0 ? String(Math.floor(ing.amount)) : String(ing.amount))
              : ing.amount)
          : null;
        const parts: string[] = [];
        if (amt != null) parts.push(`  - amount: ${q(amt)}`);
        else parts.push(`  -`);
        if (ing.unit) parts.push(`    unit: ${q(ing.unit)}`);
        parts.push(`    name: ${q(ing.name)}`);
        if (ing.note) parts.push(`    note: ${q(ing.note)}`);
        if (ing.isOptional) parts.push(`    isOptional: true`);
        if (ing.group) parts.push(`    group: ${q(ing.group)}`);
        return parts.join('\n');
      }).join('\n')
    : '  []';

  const stepsYaml = data.steps.length
    ? data.steps.map(step => {
        const parts = [`  - order: ${step.order}`, `    text: ${q(step.text)}`];
        if (step.title) parts.push(`    title: ${q(step.title)}`);
        if (step.tip) parts.push(`    tip: ${q(step.tip)}`);
        if (step.duration) parts.push(`    duration: ${step.duration}`);
        return parts.join('\n');
      }).join('\n')
    : '  []';

  const tagsYaml = tags.length
    ? tags.map(t => `  - ${q(t)}`).join('\n')
    : '  []';

  const lines = [
    '---',
    `title: ${q(data.title)}`,
    ...(data.description ? [`description: ${q(data.description)}`] : []),
    ...(data.category ? [`category: ${q(data.category)}`] : []),
    `tags:`,
    tagsYaml,
    ...(data.servings != null ? [`servings: ${data.servings}`] : []),
    ...(data.prepTime != null ? [`prepTime: ${data.prepTime}`] : []),
    ...(data.cookTime != null ? [`cookTime: ${data.cookTime}`] : []),
    ...(data.difficulty != null ? [`difficulty: ${data.difficulty}`] : []),
    ...(data.image ? [`image: ${q(data.image)}`] : []),
    `ingredients:`,
    ingredientsYaml,
    `steps:`,
    stepsYaml,
    `images: []`,
    `createdAt: ${createdAt}`,
    `updatedAt: ${today}`,
    '---',
    '',
  ].join('\n');

  writeFileSync(filePath, lines, 'utf-8');
  return { slug, title: data.title };
}
