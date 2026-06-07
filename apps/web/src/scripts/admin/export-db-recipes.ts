import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { asc, desc } from "drizzle-orm";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import * as schema from "../../lib/db/schema.js";

// Load .env.local from apps/web/
config({ path: resolve(fileURLToPath(import.meta.url), "../../../../.env.local") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required. Make sure apps/web/.env.local exists.");
  process.exit(1);
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client, { schema });

const { recipeIngredients, recipeSteps, recipes } = schema;

// ─── YAML helpers ─────────────────────────────────────────────────────────────

/** Wraps a string safely for YAML. Uses block scalar for multi-line text. */
function q(value: string | null | undefined): string {
  if (value == null || value === "") return '""';
  if (value.includes("\n")) {
    const indented = value.trimEnd().split("\n").map((l) => `  ${l}`).join("\n");
    return `|\n${indented}`;
  }
  return JSON.stringify(value);
}

function num(value: string | number | null | undefined): string {
  if (value == null) return "~";
  return String(Number(value) % 1 === 0 ? parseInt(String(value)) : value);
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

console.log("Fetching recipes from database…\n");

const allRecipes = await db.query.recipes.findMany({
  with: {
    category: true,
    recipeIngredients: {
      with: { ingredient: true },
      orderBy: [asc(recipeIngredients.order)],
    },
    recipeSteps: {
      orderBy: [asc(recipeSteps.order)],
    },
    recipeTags: { with: { tag: true } },
  },
  orderBy: [desc(recipes.createdAt)],
});

console.log(`Found ${allRecipes.length} recipe(s) in database.\n`);

// ─── Output directory ─────────────────────────────────────────────────────────

const contentDir = resolve(fileURLToPath(import.meta.url), "../../../content/recipes");
mkdirSync(contentDir, { recursive: true });

// ─── Export ───────────────────────────────────────────────────────────────────

let created = 0;
let skipped = 0;

for (const recipe of allRecipes) {
  const filePath = resolve(contentDir, `${recipe.slug}.md`);

  if (existsSync(filePath)) {
    console.log(`⏭  ${recipe.slug}  (skipped — file already exists)`);
    skipped++;
    continue;
  }

  const tags = recipe.recipeTags.map((rt) => rt.tag.name);

  // Ingredients block
  const ingredientsYaml = recipe.recipeIngredients.length
    ? recipe.recipeIngredients
        .map((ri) => {
          const amtRaw = ri.amount != null
            ? (Number(ri.amount) % 1 === 0 ? String(parseInt(ri.amount)) : ri.amount)
            : null;
          const lines = [`  - name: ${q(ri.ingredient.name)}`];
          if (amtRaw != null) lines.splice(0, 0, `  - amount: ${q(amtRaw)}`);
          else lines[0] = `  - name: ${q(ri.ingredient.name)}`;
          // rebuild: amount first, then unit, then name
          const parts: string[] = [];
          if (amtRaw != null) parts.push(`  - amount: ${q(amtRaw)}`);
          else parts.push(`  -`);
          if (ri.unit) parts.push(`    unit: ${q(ri.unit)}`);
          parts.push(`    name: ${q(ri.ingredient.name)}`);
          if (ri.note) parts.push(`    note: ${q(ri.note)}`);
          if (ri.isOptional) parts.push(`    isOptional: true`);
          if (ri.group) parts.push(`    group: ${q(ri.group)}`);
          return parts.join("\n");
        })
        .join("\n")
    : "  []";

  // Steps block
  const stepsYaml = recipe.recipeSteps.length
    ? recipe.recipeSteps
        .map((step) => {
          const lines = [
            `  - order: ${step.order}`,
            `    text: ${q(step.description)}`,
          ];
          if (step.title) lines.push(`    title: ${q(step.title)}`);
          if (step.tip) lines.push(`    tip: ${q(step.tip)}`);
          if (step.duration) lines.push(`    duration: ${step.duration}`);
          return lines.join("\n");
        })
        .join("\n")
    : "  []";

  // Tags block
  const tagsYaml = tags.length
    ? tags.map((t) => `  - ${q(t)}`).join("\n")
    : "  []";

  // Cover image: use DB imageUrl if present, else leave local path placeholder
  const imageValue = recipe.imageUrl ? q(recipe.imageUrl) : null;

  const createdAt = recipe.createdAt.toISOString().split("T")[0];
  const updatedAt = recipe.updatedAt.toISOString().split("T")[0];

  const frontmatter = [
    "---",
    `title: ${q(recipe.title)}`,
    `description: ${q(recipe.description)}`,
    `category: ${recipe.category ? q(recipe.category.name) : "~"}`,
    `tags:`,
    tagsYaml,
    ...(recipe.servings != null ? [`servings: ${recipe.servings}`] : []),
    ...(recipe.prepTime != null ? [`prepTime: ${recipe.prepTime}`] : []),
    ...(recipe.cookTime != null ? [`cookTime: ${recipe.cookTime}`] : []),
    ...(recipe.difficulty != null ? [`difficulty: ${recipe.difficulty}`] : []),
    ...(imageValue ? [`image: ${imageValue}`] : []),
    `ingredients:`,
    ingredientsYaml,
    `steps:`,
    stepsYaml,
    `images: []`,
    `createdAt: ${createdAt}`,
    `updatedAt: ${updatedAt}`,
    "---",
    "",
    // Markdown body: long description or notes go here
    recipe.description ? recipe.description : "",
    "",
  ].join("\n");

  writeFileSync(filePath, frontmatter, "utf-8");
  console.log(`✓  ${recipe.slug}`);
  created++;
}

await client.end();
console.log(`\nDone: ${created} created, ${skipped} skipped.`);
