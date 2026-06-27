import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "http";

// ─── helpers (dev only) ───────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function detectMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return "image/heic";
  return null;
}

function send(res: ServerResponse, data: unknown, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body);
}

// Intercepts /api/ocr, /api/images, /api/recipes with raw Node.js streams.
// Bypasses Astro's Web-Fetch wrapper which loses the body in dev mode.
function devApiPlugin(): Plugin {
  return {
    name: "dev-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (req.method !== "POST" && req.method !== "PATCH") return next();

        // ── OCR ──────────────────────────────────────────────────────────────
        if (req.url === "/api/ocr") {
          try {
            const buffer = await readBody(req);
            if (!buffer.length) return send(res, { error: "No image received" }, 400);

            const mime = detectMime(buffer);
            if (!mime) return send(res, { error: "Unrecognised image format. Supported: JPEG, PNG, WebP, HEIC" }, 400);

            const { extractRecipeFromImage } = await server.ssrLoadModule("/src/lib/ocr/index.ts");
            const { saveRecipeToFile } = await server.ssrLoadModule("/src/lib/content/save-recipe.ts");

            const extracted = await extractRecipeFromImage(buffer, mime);
            const recipe = saveRecipeToFile({
              title: extracted.title,
              description: extracted.description,
              category: extracted.category,
              tags: ['ocr', ...extracted.tags],
              servings: extracted.servings,
              prepTime: extracted.prepTime,
              cookTime: extracted.cookTime,
              difficulty: extracted.difficulty,
              ingredients: extracted.ingredients.map((i: any) => ({
                name: i.name, amount: i.amount, unit: i.unit,
                note: i.note, isOptional: i.isOptional, group: i.group,
              })),
              steps: extracted.steps.map((s: any) => ({
                order: s.order, text: s.description,
                title: s.title, tip: s.tip, duration: s.duration,
              })),
            });

            return send(res, { success: true, recipe });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("[ocr]", err);
            return send(res, { error: message }, 500);
          }
        }

        // ── Image upload ──────────────────────────────────────────────────────
        if (req.url === "/api/images") {
          try {
            const buffer = await readBody(req);
            if (!buffer.length) return send(res, { error: "Kein Bild empfangen" }, 400);

            const extMap: Record<string, string> = {
              "image/jpeg": "jpg", "image/png": "png",
              "image/webp": "webp", "image/heic": "heic",
            };
            const mime = detectMime(buffer);
            const ext = mime ? (extMap[mime] ?? "jpg") : "jpg";

            const filename = `${randomUUID()}.${ext}`;
            const dir = join(process.cwd(), "public", "images", "recipes");
            await mkdir(dir, { recursive: true });
            await writeFile(join(dir, filename), buffer);

            return send(res, { url: `/images/recipes/${filename}` });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return send(res, { error: message }, 500);
          }
        }

        // ── Recipe edit (PATCH /api/recipes/:slug) ────────────────────────────
        const patchMatch = req.method === "PATCH" && req.url?.match(/^\/api\/recipes\/([^/?]+)$/);
        if (patchMatch) {
          const slug = patchMatch[1];
          try {
            const body = JSON.parse((await readBody(req)).toString());
            const { updateRecipeFile } = await server.ssrLoadModule("/src/lib/content/save-recipe.ts");
            updateRecipeFile(slug, {
              title: body.title,
              description: body.description,
              category: body.category,
              tags: body.tags ?? [],
              servings: body.servings,
              prepTime: body.prepTime,
              cookTime: body.cookTime,
              difficulty: body.difficulty,
              image: body.imageUrl,
              ingredients: (body.ingredients ?? []).map((i: any) => ({
                name: i.name,
                amount: i.amount != null ? String(i.amount) : undefined,
                unit: i.unit,
                note: i.note,
                isOptional: i.isOptional ?? false,
                group: i.group,
              })),
              steps: (body.steps ?? []).map((s: any) => ({
                order: s.order,
                text: s.description,
                title: s.title,
                tip: s.tip,
                duration: s.duration,
              })),
            });
            return send(res, { success: true });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("[edit]", err);
            return send(res, { error: message }, 500);
          }
        }

        // ── Recipe form ───────────────────────────────────────────────────────
        if (req.url === "/api/recipes") {
          try {
            const body = JSON.parse((await readBody(req)).toString());
            if (!body.title?.trim()) return send(res, { error: "Title is required" }, 400);

            const { saveRecipeToFile } = await server.ssrLoadModule("/src/lib/content/save-recipe.ts");

            const recipe = saveRecipeToFile({
              title: body.title.trim(),
              description: body.description?.trim() || undefined,
              servings: body.servings ?? undefined,
              prepTime: body.prepTimeMinutes ?? undefined,
              cookTime: body.cookTimeMinutes ?? undefined,
              image: body.imageUrl || undefined,
              ingredients: (body.ingredients ?? [])
                .filter((i: any) => i.name?.trim())
                .map((i: any) => ({ name: i.name.trim(), amount: i.amount || undefined, unit: i.unit || undefined })),
              steps: body.instructions?.trim()
                ? [{ order: 1, text: body.instructions.trim() }]
                : [],
            });

            return send(res, { success: true, slug: recipe.slug });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return send(res, { error: message }, 500);
          }
        }

        next();
      });
    },
  };
}

// ─── Astro config ─────────────────────────────────────────────────────────────

export default defineConfig({
  output: "hybrid",
  adapter: node({ mode: "standalone" }),
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
  ],
  vite: {
    plugins: [devApiPlugin()],
    resolve: {
      dedupe: ["react", "react-dom", "react-dom/server"],
    },
  },
});
