import { useCallback, useRef, useState } from 'react';

type Status = 'idle' | 'uploading' | 'done' | 'error';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_SIZE = 10 * 1024 * 1024;

export default function ImageUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [loadingMsg, setLoadingMsg] = useState('Bild wird analysiert...');
  const [result, setResult] = useState<{ slug: string; title: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function reset() {
    setFile(null);
    setPreview(null);
    setStatus('idle');
    setResult(null);
    setErrorMsg(null);
    setLoadingMsg('Bild wird analysiert...');
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  function pickFile(picked: File) {
    if (!ACCEPTED.includes(picked.type)) {
      setErrorMsg('Ungültiges Dateiformat. Erlaubt: JPG, PNG, WebP, HEIC');
      return;
    }
    if (picked.size > MAX_SIZE) {
      setErrorMsg('Datei zu groß. Maximum 10 MB');
      return;
    }
    setErrorMsg(null);
    setFile(picked);
    setStatus('idle');
    setResult(null);

    const url = URL.createObjectURL(picked);
    setPreview(url);
  }

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setDragging(false), []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) pickFile(dropped);
  }, []);

  async function handleUpload() {
    if (!file) return;

    setStatus('uploading');
    setLoadingMsg('Bild wird analysiert...');
    setErrorMsg(null);

    timerRef.current = setTimeout(() => {
      setLoadingMsg('Rezept wird gespeichert...');
    }, 12_000);

    try {
      const form = new FormData();
      form.append('image', file);

      const res = await fetch('/api/ocr', { method: 'POST', body: form });
      const data = await res.json() as { success?: boolean; recipe?: { slug: string; title: string }; error?: string };

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Unbekannter Fehler');
      }

      setResult(data.recipe!);
      setStatus('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unbekannter Fehler');
      setStatus('error');
    } finally {
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onClick={() => status === 'idle' && inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={[
          'relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors',
          dragging
            ? 'border-stone-500 bg-stone-100'
            : 'border-stone-300 bg-stone-50 hover:border-stone-400 hover:bg-stone-100',
          status === 'uploading' ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="sr-only"
          onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
        />

        {preview ? (
          <img
            src={preview}
            alt="Vorschau"
            className="max-h-64 max-w-full rounded object-contain shadow"
          />
        ) : (
          <>
            <svg
              className="mb-3 h-10 w-10 text-stone-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className="text-sm font-medium text-stone-700">
              Bild hierher ziehen oder klicken
            </p>
            <p className="mt-1 text-xs text-stone-500">JPG, PNG, WebP, HEIC — max. 10 MB</p>
          </>
        )}
      </div>

      {/* Error */}
      {errorMsg && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</p>
      )}

      {/* Success */}
      {status === 'done' && result && (
        <div className="rounded-md bg-green-50 px-4 py-4 text-sm text-green-800">
          <p className="font-medium">Rezept gespeichert!</p>
          <p className="mt-1">{result.title}</p>
          <a
            href="/admin/ocr"
            className="mt-2 inline-block underline hover:no-underline"
          >
            Weitere importieren →
          </a>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {file && status !== 'uploading' && status !== 'done' && (
          <button
            onClick={handleUpload}
            className="rounded-md bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700"
          >
            Rezept extrahieren
          </button>
        )}

        {status === 'uploading' && (
          <button
            disabled
            className="flex items-center gap-2 rounded-md bg-stone-900 px-5 py-2.5 text-sm font-medium text-white opacity-70"
          >
            <Spinner />
            {loadingMsg}
          </button>
        )}

        {(file || status === 'done' || status === 'error') && (
          <button
            onClick={reset}
            className="rounded-md border border-stone-300 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50"
          >
            Zurücksetzen
          </button>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
