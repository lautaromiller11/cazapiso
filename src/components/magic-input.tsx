"use client";

import { useState } from "react";
import {
  Link as LinkIcon,
  Loader2,
  Search,
  Edit3,
  Check,
  X,
  ImageOff,
  PenLine,
} from "lucide-react";
import type { ExtractedData } from "@/lib/types";
import type { PropertyFeatures } from "@/lib/types";
import { PropertyFeatureEditor } from "@/components/property-feature-editor";

interface MagicInputProps {
  onSave: (data: {
    title: string;
    original_url?: string | null;
    price?: number | null;
    image_url?: string | null;
    description?: string | null;
    features?: PropertyFeatures;
  }) => Promise<void>;
}

type Step = "input" | "loading" | "preview" | "manual";

export function MagicInput({ onSave }: MagicInputProps) {
  const [step, setStep] = useState<Step>("input");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Preview/edit state
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<string>("");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [originalUrl, setOriginalUrl] = useState("");
  const [features, setFeatures] = useState<PropertyFeatures>({});

  const resetAll = () => {
    setStep("input");
    setUrl("");
    setError(null);
    setTitle("");
    setPrice("");
    setImageUrl("");
    setDescription("");
    setOriginalUrl("");
    setFeatures({});
  };

  const handleExtract = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    // Basic URL validation
    try {
      const parsed = new URL(trimmed);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        setError("La URL debe comenzar con http:// o https://");
        return;
      }
    } catch {
      setError("Introduce una URL válida");
      return;
    }

    setError(null);
    setStep("loading");

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const data: ExtractedData = await res.json();

      setOriginalUrl(trimmed);

      if (data.success) {
        setTitle(data.title || "");
        setPrice(data.price ? String(data.price) : "");
        setImageUrl(data.imageUrl || "");
        setDescription(data.description || "");
        setFeatures(data.features || {});
        setStep("preview");
      } else {
        // Extraction failed — let user fill manually
        setTitle("");
        setPrice("");
        setImageUrl("");
        setDescription("");
        setFeatures({});
        setError(
          data.error || "No se pudieron extraer los datos. Puedes introducirlos manualmente."
        );
        setStep("preview");
      }
    } catch {
      setOriginalUrl(trimmed);
      setError("Error de conexión. Puedes introducir los datos manualmente.");
      setStep("preview");
    }
  };

  const handleManual = () => {
    setError(null);
    setOriginalUrl("");
    setTitle("");
    setPrice("");
    setImageUrl("");
    setDescription("");
    setStep("manual");
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("El título es obligatorio");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const parsedPrice = price ? parseFloat(price) : null;
      await onSave({
        title: title.trim(),
        original_url: originalUrl || null,
        price: parsedPrice && !isNaN(parsedPrice) ? parsedPrice : null,
        image_url: imageUrl || null,
        description: description || null,
        features,
      });
      resetAll();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error al guardar. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && step === "input") {
      e.preventDefault();
      handleExtract();
    }
  };

  // --- INPUT STEP ---
  if (step === "input") {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Pega el enlace del anuncio..."
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <button
            onClick={handleExtract}
            disabled={!url.trim()}
            className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm font-medium shrink-0"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Añadir</span>
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 px-1">{error}</p>
        )}

        <button
          onClick={handleManual}
          className="flex items-center gap-1.5 px-1 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <PenLine className="h-3.5 w-3.5" />
          Introducir datos manualmente
        </button>
      </div>
    );
  }

  // --- LOADING STEP ---
  if (step === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="text-sm text-gray-500 dark:text-slate-400">Extrayendo datos del anuncio...</p>
        <button
          onClick={resetAll}
          className="text-sm text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-slate-300"
        >
          Cancelar
        </button>
      </div>
    );
  }

  // --- PREVIEW / MANUAL STEP ---
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* Image preview */}
      {imageUrl ? (
          <div className="relative h-48 bg-gray-100 dark:bg-slate-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={title || "Imagen del anuncio"}
            className="w-full h-full object-cover"
            onError={() => setImageUrl("")}
          />
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center bg-gray-50 dark:bg-slate-800">
          <ImageOff className="h-8 w-8 text-gray-300" />
        </div>
      )}

      <div className="p-4 space-y-3">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <Edit3 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Title */}
        <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">Título *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Piso 2 hab. en Eixample"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        {/* Price */}
        <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">Precio</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Ej: 1200"
            min="0"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        {/* Image URL (editable) */}
        <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">URL de imagen</label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        {/* URL (only for manual) */}
        {step === "manual" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">URL del anuncio</label>
            <input
              type="url"
              value={originalUrl}
              onChange={(e) => setOriginalUrl(e.target.value)}
              placeholder="https://..."
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        )}

        <section aria-label="Características del inmueble"><h3 className="mb-2 text-sm font-medium text-gray-800 dark:text-slate-200">Características del inmueble</h3><PropertyFeatureEditor value={features} onChange={setFeatures} /></section>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Guardar propiedad
          </button>
          <button
            onClick={resetAll}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
