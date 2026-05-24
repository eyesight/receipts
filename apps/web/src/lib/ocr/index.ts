import Anthropic from '@anthropic-ai/sdk';

export interface ExtractedRecipe {
  title: string;
  description: string | null;
  servings: number | null;
  prepTime: number | null;
  cookTime: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  ingredients: Array<{
    name: string;
    amount: number | null;
    unit: string | null;
    note: string | null;
    isOptional: boolean;
    group: string | null;
  }>;
  steps: Array<{
    order: number;
    title: string | null;
    description: string;
    duration: number | null;
    tip: string | null;
  }>;
  tags: string[];
  category: string | null;
  source: string | null;
}

const EXTRACTION_PROMPT = `Du bist ein Rezept-Assistent. Extrahiere alle Rezeptinformationen aus diesem Bild und gib NUR valides JSON zurück – kein Markdown, keine Erklärungen.

WICHTIG: Alle Textfelder (Titel, Beschreibung, Zutaten, Schritte, Tags, Kategorie) müssen auf DEUTSCH sein. Falls das Rezept in einer anderen Sprache vorliegt, übersetze alles ins Deutsche.

Verwende genau diese Struktur:
{
  "title": string,
  "description": string | null,
  "servings": number | null,
  "prepTime": number | null,
  "cookTime": number | null,
  "difficulty": "easy" | "medium" | "hard" | null,
  "ingredients": [
    {
      "name": string,
      "amount": number | null,
      "unit": string | null,
      "note": string | null,
      "isOptional": boolean,
      "group": string | null
    }
  ],
  "steps": [
    {
      "order": number,
      "title": string | null,
      "description": string,
      "duration": number | null,
      "tip": string | null
    }
  ],
  "tags": string[],
  "category": string | null,
  "source": string | null
}

Regeln:
- Alle Texte auf Deutsch – übersetze falls nötig
- prepTime und cookTime in ganzen Minuten
- Zutaten-Namen einheitlich auf Deutsch (z.B. "Zwiebel" statt "onion", "Mehl" statt "flour")
- Maßeinheiten auf Deutsch (z.B. "EL" für Esslöffel, "TL" für Teelöffel, "g", "kg", "ml", "L")
- isOptional standardmäßig false
- steps[].order beginnt bei 1
- tags: passende kulinarische Begriffe auf Deutsch (Küche, Diät, Anlass)
- Nur das JSON-Objekt zurückgeben, nichts sonst`;

const CLAUDE_MEDIA_TYPES: Record<string, Anthropic.Base64ImageSource['media_type']> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
  'image/gif': 'image/gif',
};

export async function extractRecipeFromImage(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractedRecipe> {
  const mediaType = CLAUDE_MEDIA_TYPES[mimeType];
  if (!mediaType) {
    throw new Error(
      `Unsupported image type for OCR: ${mimeType}. Please use JPG, PNG, or WebP.`
    );
  }

  const client = new Anthropic({ apiKey: import.meta.env.ANTHROPIC_API_KEY as string });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: [
      {
        type: 'text',
        text: EXTRACTION_PROMPT,
        // Cache the static prompt across requests — saves tokens after first call
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: buffer.toString('base64'),
            },
          },
          {
            type: 'text',
            text: 'Extrahiere das Rezept aus diesem Bild auf Deutsch.',
          },
        ],
      },
    ],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';

  // Strip markdown code fences if Claude added them despite instructions
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  try {
    return JSON.parse(text) as ExtractedRecipe;
  } catch {
    throw new Error(`Claude returned invalid JSON: ${text.slice(0, 300)}`);
  }
}
