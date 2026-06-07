import { useState } from 'react';
import ImageUploadField from './ImageUploadField';

interface Ingredient {
  name: string;
  amount: string;
  unit: string;
  note: string;
  isOptional: boolean;
  group: string;
}

interface Step {
  title: string;
  description: string;
  duration: string;
  tip: string;
}

interface RecipeData {
  title: string;
  description: string;
  servings: string;
  prepTime: string;
  cookTime: string;
  difficulty: string;
  category: string;
  source: string;
  isPublished: boolean;
  imageUrl: string;
  ingredients: Ingredient[];
  steps: Step[];
  tags: string;
}

interface Props {
  slug: string;
  initial: RecipeData;
}

const inputClass =
  'w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500';
const labelClass = 'block text-sm font-medium mb-1';

export default function RecipeEditForm({ slug, initial }: Props) {
  const [form, setForm] = useState<RecipeData>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setField<K extends keyof RecipeData>(key: K, value: RecipeData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  // ── Ingredients ──────────────────────────────────────────────────────────────

  function updateIngredient(i: number, field: keyof Ingredient, value: string | boolean) {
    setForm((f) => {
      const ingredients = f.ingredients.map((ing, idx) =>
        idx === i ? { ...ing, [field]: value } : ing
      );
      return { ...f, ingredients };
    });
    setSaved(false);
  }

  function addIngredient() {
    setForm((f) => ({
      ...f,
      ingredients: [
        ...f.ingredients,
        { name: '', amount: '', unit: '', note: '', isOptional: false, group: '' },
      ],
    }));
  }

  function removeIngredient(i: number) {
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, idx) => idx !== i) }));
  }

  // ── Steps ────────────────────────────────────────────────────────────────────

  function updateStep(i: number, field: keyof Step, value: string) {
    setForm((f) => {
      const steps = f.steps.map((s, idx) => (idx === i ? { ...s, [field]: value } : s));
      return { ...f, steps };
    });
    setSaved(false);
  }

  function addStep() {
    setForm((f) => ({
      ...f,
      steps: [...f.steps, { title: '', description: '', duration: '', tip: '' }],
    }));
  }

  function removeStep(i: number) {
    setForm((f) => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }));
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const body = {
        title: form.title,
        description: form.description || null,
        servings: form.servings ? Number(form.servings) : null,
        prepTime: form.prepTime ? Number(form.prepTime) : null,
        cookTime: form.cookTime ? Number(form.cookTime) : null,
        difficulty: form.difficulty || null,
        category: form.category || null,
        source: form.source || null,
        isPublished: form.isPublished,
        imageUrl: form.imageUrl || null,
        ingredients: form.ingredients
          .filter((ing) => ing.name.trim())
          .map((ing) => ({
            name: ing.name,
            amount: ing.amount ? Number(ing.amount) : null,
            unit: ing.unit || null,
            note: ing.note || null,
            isOptional: ing.isOptional,
            group: ing.group || null,
          })),
        steps: form.steps
          .filter((s) => s.description.trim())
          .map((s, i) => ({
            order: i + 1,
            title: s.title || null,
            description: s.description,
            duration: s.duration ? Number(s.duration) : null,
            tip: s.tip || null,
          })),
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };

      const res = await fetch(`/api/recipes/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Unbekannter Fehler');
      }

      setSaved(true);
      window.location.href = `/recipes/${slug}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}
      {saved && (
        <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          Gespeichert!{' '}
          <a href={`/recipes/${slug}`} className="underline">
            Rezept ansehen →
          </a>
        </p>
      )}

      {/* Basic info */}
      <div className="space-y-4">
        {/* Image */}
        <div>
          <label className={labelClass}>Bild</label>
          <ImageUploadField
            value={form.imageUrl}
            onChange={(url) => setField('imageUrl', url)}
          />
        </div>

        <div>
          <label className={labelClass}>Titel *</label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Beschreibung</label>
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(
            [
              { label: 'Portionen', key: 'servings' },
              { label: 'Vorbereitung (Min.)', key: 'prepTime' },
              { label: 'Kochzeit (Min.)', key: 'cookTime' },
            ] as const
          ).map(({ label, key }) => (
            <div key={key}>
              <label className={labelClass}>{label}</label>
              <input
                type="number"
                min="0"
                value={form[key]}
                onChange={(e) => setField(key, e.target.value)}
                className={inputClass}
              />
            </div>
          ))}

          <div>
            <label className={labelClass}>Schwierigkeit</label>
            <select
              value={form.difficulty}
              onChange={(e) => setField('difficulty', e.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              <option value="easy">Einfach</option>
              <option value="medium">Mittel</option>
              <option value="hard">Schwer</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Kategorie</label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => setField('category', e.target.value)}
              className={inputClass}
              placeholder="z.B. Hauptgericht"
            />
          </div>
          <div>
            <label className={labelClass}>Tags (kommagetrennt)</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setField('tags', e.target.value)}
              className={inputClass}
              placeholder="z.B. vegetarisch, schnell"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Quelle</label>
          <input
            type="text"
            value={form.source}
            onChange={(e) => setField('source', e.target.value)}
            className={inputClass}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isPublished}
            onChange={(e) => setField('isPublished', e.target.checked)}
            className="rounded border-stone-300"
          />
          Rezept veröffentlichen
        </label>
      </div>

      {/* Ingredients */}
      <fieldset className="space-y-3">
        <legend className="text-base font-semibold">Zutaten</legend>
        {form.ingredients.map((ing, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <input
              type="text"
              value={ing.amount}
              onChange={(e) => updateIngredient(i, 'amount', e.target.value)}
              placeholder="Menge"
              className="w-20 rounded-md border border-stone-300 px-2 py-2 text-sm shadow-sm focus:border-stone-500 focus:outline-none"
            />
            <input
              type="text"
              value={ing.unit}
              onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
              placeholder="Einheit"
              className="w-20 rounded-md border border-stone-300 px-2 py-2 text-sm shadow-sm focus:border-stone-500 focus:outline-none"
            />
            <input
              type="text"
              value={ing.name}
              onChange={(e) => updateIngredient(i, 'name', e.target.value)}
              placeholder="Zutat *"
              className="min-w-32 flex-1 rounded-md border border-stone-300 px-2 py-2 text-sm shadow-sm focus:border-stone-500 focus:outline-none"
            />
            <input
              type="text"
              value={ing.note}
              onChange={(e) => updateIngredient(i, 'note', e.target.value)}
              placeholder="Anmerkung"
              className="min-w-24 flex-1 rounded-md border border-stone-300 px-2 py-2 text-sm shadow-sm focus:border-stone-500 focus:outline-none"
            />
            <label className="flex items-center gap-1 text-xs text-stone-500">
              <input
                type="checkbox"
                checked={ing.isOptional}
                onChange={(e) => updateIngredient(i, 'isOptional', e.target.checked)}
              />
              optional
            </label>
            <button
              type="button"
              onClick={() => removeIngredient(i)}
              className="px-2 text-stone-400 hover:text-red-600"
              aria-label="Entfernen"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addIngredient}
          className="text-sm text-stone-500 underline hover:text-stone-900"
        >
          + Zutat hinzufügen
        </button>
      </fieldset>

      {/* Steps */}
      <fieldset className="space-y-6">
        <legend className="text-base font-semibold">Zubereitung</legend>
        {form.steps.map((step, i) => (
          <div key={i} className="flex gap-3">
            <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-bold text-stone-600">
              {i + 1}
            </span>
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={step.title}
                  onChange={(e) => updateStep(i, 'title', e.target.value)}
                  placeholder="Titel (optional)"
                  className="flex-1 rounded-md border border-stone-300 px-2 py-2 text-sm shadow-sm focus:border-stone-500 focus:outline-none"
                />
                <input
                  type="number"
                  value={step.duration}
                  onChange={(e) => updateStep(i, 'duration', e.target.value)}
                  placeholder="Min."
                  min="0"
                  className="w-20 rounded-md border border-stone-300 px-2 py-2 text-sm shadow-sm focus:border-stone-500 focus:outline-none"
                />
              </div>
              <textarea
                rows={3}
                value={step.description}
                onChange={(e) => updateStep(i, 'description', e.target.value)}
                placeholder="Beschreibung *"
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-stone-500 focus:outline-none"
              />
              <input
                type="text"
                value={step.tip}
                onChange={(e) => updateStep(i, 'tip', e.target.value)}
                placeholder="💡 Tipp (optional)"
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-stone-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => removeStep(i)}
              className="mt-2 px-1 text-stone-400 hover:text-red-600"
              aria-label="Schritt entfernen"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addStep}
          className="text-sm text-stone-500 underline hover:text-stone-900"
        >
          + Schritt hinzufügen
        </button>
      </fieldset>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {saving ? 'Speichern…' : 'Speichern'}
        </button>
        <a
          href={`/recipes/${slug}`}
          className="rounded-md border border-stone-300 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50"
        >
          Abbrechen
        </a>
      </div>
    </form>
  );
}
