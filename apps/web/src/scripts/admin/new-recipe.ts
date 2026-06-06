import { input, select, number } from "@inquirer/prompts";
import { writeFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.resolve(__dirname, "../../content/recipes");

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const title = await input({ message: "Titel des Rezepts:" });
const category = await input({
  message: "Kategorie (z.B. Pasta & Kartoffeln):",
  default: "",
});
const servings = await number({ message: "Portionen:", default: 4 });
const prepTime = await number({ message: "Vorbereitungszeit (Min.):", default: 15 });
const cookTime = await number({ message: "Kochzeit (Min.):", default: 30 });
const difficulty = await select({
  message: "Schwierigkeit:",
  choices: [
    { name: "Einfach", value: "easy" },
    { name: "Mittel", value: "medium" },
    { name: "Schwer", value: "hard" },
  ],
});

const slug = slugify(title);
const today = new Date().toISOString().split("T")[0];
const filePath = path.join(contentDir, `${slug}.md`);

const frontmatter = [
  "---",
  `title: ${title}`,
  `description: ""`,
  category ? `category: ${category}` : "category: ~",
  "tags: []",
  `servings: ${servings}`,
  `prepTime: ${prepTime}`,
  `cookTime: ${cookTime}`,
  `difficulty: ${difficulty}`,
  `image: /images/recipes/${slug}/cover.jpg`,
  "ingredients:",
  "  - amount: ~",
  "    unit: ~",
  "    name: Zutat",
  "steps:",
  "  - order: 1",
  "    text: Schritt beschreiben",
  "images: []",
  `createdAt: ${today}`,
  `updatedAt: ${today}`,
  "---",
  "",
  "",
].join("\n");

mkdirSync(contentDir, { recursive: true });
writeFileSync(filePath, frontmatter, "utf-8");

console.log(`\n✓ Rezept erstellt: src/content/recipes/${slug}.md`);

try {
  execSync(`code "${filePath}"`, { stdio: "ignore" });
} catch {
  console.log(`Datei öffnen: ${filePath}`);
}
