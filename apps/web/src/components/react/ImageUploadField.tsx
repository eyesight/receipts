import { useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (url: string) => void;
  uploadLabel?: string;
  changeLabel?: string;
  removeLabel?: string;
}

export default function ImageUploadField({
  value,
  onChange,
  uploadLabel = 'Bild hochladen',
  changeLabel = 'Bild ändern',
  removeLabel = 'Entfernen',
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local blob URL shown during and after upload — avoids flicker when parent state propagates
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Revoke previous blob URL before creating a new one
    if (localPreview) URL.revokeObjectURL(localPreview);
    const blob = URL.createObjectURL(file);
    setLocalPreview(blob);
    setUploading(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/images', { method: 'POST', body: fd });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Upload fehlgeschlagen');
      onChange(data.url);
      // Keep localPreview — same image, no flicker. Revoked on next upload or remove.
    } catch (err) {
      URL.revokeObjectURL(blob);
      setLocalPreview(null);
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleRemove() {
    if (localPreview) { URL.revokeObjectURL(localPreview); setLocalPreview(null); }
    onChange('');
  }

  const preview = localPreview ?? (value || null);
  const hasImage = !!preview;

  return (
    <div className="space-y-2">
      {preview && (
        <img src={preview} alt="Vorschau" className="h-40 w-full rounded-lg object-cover shadow" />
      )}
      <div className="flex items-center gap-3">
        <label className={`cursor-pointer rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50 ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
          {uploading ? '…' : hasImage ? changeLabel : uploadLabel}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="sr-only"
            onChange={handleChange}
            disabled={uploading}
          />
        </label>
        {hasImage && !uploading && (
          <button type="button" onClick={handleRemove} className="text-sm text-stone-400 hover:text-red-600">
            {removeLabel}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
