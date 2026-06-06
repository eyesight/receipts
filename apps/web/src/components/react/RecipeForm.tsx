import { useRef, useState } from "react";

interface Ingredient {
  name: string;
  amount: string;
  unit: string;
}

interface FormState {
  title: string;
  description: string;
  servings: string;
  prepTimeMinutes: string;
  cookTimeMinutes: string;
  ingredients: Ingredient[];
  instructions: string;
  imageUrl: string;
}

const emptyIngredient = (): Ingredient => ({ name: "", amount: "", unit: "" });

export default function RecipeForm() {
  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    servings: "",
    prepTimeMinutes: "",
    cookTimeMinutes: "",
    ingredients: [emptyIngredient()],
    instructions: "",
    imageUrl: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateIngredient(index: number, field: keyof Ingredient, value: string) {
    setForm((prev) => {
      const ingredients = prev.ingredients.map((ing, i) =>
        i === index ? { ...ing, [field]: value } : ing
      );
      return { ...prev, ingredients };
    });
  }

  function addIngredient() {
    setForm((prev) => ({ ...prev, ingredients: [...prev.ingredients, emptyIngredient()] }));
  }

  function removeIngredient(index: number) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setImageError(null);
    try {
      const res = await fetch("/api/images", { method: "POST", body: file });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed");
      updateField("imageUrl", data.url);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          servings: form.servings ? Number(form.servings) : undefined,
          prepTimeMinutes: form.prepTimeMinutes ? Number(form.prepTimeMinutes) : undefined,
          cookTimeMinutes: form.cookTimeMinutes ? Number(form.cookTimeMinutes) : undefined,
          ingredients: form.ingredients.filter((ing) => ing.name.trim()),
          imageUrl: form.imageUrl || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { slug: string };
      window.location.href = `/recipes/${data.slug}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {/* Image */}
      <div className="space-y-1">
        <label className="block text-sm font-medium">Image</label>
        <div className="space-y-2">
          {form.imageUrl && (
            <img
              src={form.imageUrl}
              alt="Preview"
              className="h-40 w-full rounded-lg object-cover shadow"
            />
          )}
          <div className="flex items-center gap-3">
            <label className={`cursor-pointer rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50 ${uploadingImage ? "pointer-events-none opacity-50" : ""}`}>
              {uploadingImage ? "Uploading…" : form.imageUrl ? "Change image" : "Upload image"}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                className="sr-only"
                onChange={handleImageChange}
                disabled={uploadingImage}
              />
            </label>
            {form.imageUrl && !uploadingImage && (
              <button
                type="button"
                onClick={() => updateField("imageUrl", "")}
                className="text-sm text-stone-400 hover:text-red-600"
              >
                Remove
              </button>
            )}
          </div>
          {imageError && <p className="text-sm text-red-600">{imageError}</p>}
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1">
        <label htmlFor="title" className="block text-sm font-medium">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          required
          value={form.title}
          onChange={(e) => updateField("title", e.target.value)}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
          placeholder="e.g. Grandma's Lasagna"
        />
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label htmlFor="description" className="block text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          rows={2}
          value={form.description}
          onChange={(e) => updateField("description", e.target.value)}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
          placeholder="A short description…"
        />
      </div>

      {/* Timing & servings */}
      <div className="grid grid-cols-3 gap-4">
        {(
          [
            { id: "servings", label: "Servings", key: "servings" },
            { id: "prepTimeMinutes", label: "Prep (min)", key: "prepTimeMinutes" },
            { id: "cookTimeMinutes", label: "Cook (min)", key: "cookTimeMinutes" },
          ] as const
        ).map(({ id, label, key }) => (
          <div key={id} className="space-y-1">
            <label htmlFor={id} className="block text-sm font-medium">
              {label}
            </label>
            <input
              id={id}
              type="number"
              min="0"
              value={form[key]}
              onChange={(e) => updateField(key, e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            />
          </div>
        ))}
      </div>

      {/* Ingredients */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Ingredients</legend>
        {form.ingredients.map((ing, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={ing.amount}
              onChange={(e) => updateIngredient(i, "amount", e.target.value)}
              placeholder="Amount"
              className="w-20 rounded-md border border-stone-300 px-2 py-2 text-sm shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            />
            <input
              type="text"
              value={ing.unit}
              onChange={(e) => updateIngredient(i, "unit", e.target.value)}
              placeholder="Unit"
              className="w-20 rounded-md border border-stone-300 px-2 py-2 text-sm shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            />
            <input
              type="text"
              value={ing.name}
              onChange={(e) => updateIngredient(i, "name", e.target.value)}
              placeholder="Ingredient name"
              className="flex-1 rounded-md border border-stone-300 px-2 py-2 text-sm shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            />
            {form.ingredients.length > 1 && (
              <button
                type="button"
                onClick={() => removeIngredient(i)}
                className="rounded-md px-2 py-2 text-stone-400 hover:text-red-600"
                aria-label="Remove ingredient"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addIngredient}
          className="text-sm text-stone-500 hover:text-stone-900 underline"
        >
          + Add ingredient
        </button>
      </fieldset>

      {/* Instructions */}
      <div className="space-y-1">
        <label htmlFor="instructions" className="block text-sm font-medium">
          Instructions <span className="text-red-500">*</span>
        </label>
        <textarea
          id="instructions"
          required
          rows={8}
          value={form.instructions}
          onChange={(e) => updateField("instructions", e.target.value)}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
          placeholder="Step-by-step instructions…"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save recipe"}
      </button>
    </form>
  );
}
