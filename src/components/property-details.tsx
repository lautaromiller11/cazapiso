"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, ImageOff, Loader2, Pencil, Save, StickyNote, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PropertyFeatureEditor } from "@/components/property-feature-editor";
import { STATUS_CONFIG } from "@/lib/types";
import type { Property, PropertyFeatures, PropertyNote, PropertyStatus } from "@/lib/types";

interface PropertyDetailsProps {
  propertyId: string;
  onClose?: () => void;
  onUpdated?: (property: Property) => void;
  onAddNote?: (id: string, content: string) => Promise<PropertyNote>;
}

type Draft = Pick<Property, "title" | "price" | "image_url" | "original_url" | "description" | "status"> & { features: PropertyFeatures };

const groups: { title: string; fields: [string, string][] }[] = [
  { title: "Características básicas", fields: [["constructed_area_m2", "Superficie construida"], ["usable_area_m2", "Superficie útil"], ["area_m2", "Superficie"], ["bedrooms", "Dormitorios"], ["rooms", "Habitaciones"], ["bathrooms", "Baños"], ["balcony", "Balcón"], ["terrace", "Terraza"], ["garage_type", "Garaje"], ["garage_included", "Garaje incluido"], ["property_age", "Antigüedad"], ["property_condition", "Estado del inmueble"], ["orientation", "Orientación"], ["year_built", "Año de construcción"], ["furnished", "Amueblado"], ["kitchen_equipped", "Cocina equipada"]] },
  { title: "Edificio", fields: [["floor", "Planta"], ["exterior", "Exterior"], ["elevator", "Ascensor"], ["building_details", "Otros datos del edificio"]] },
  { title: "Equipamiento", fields: [["air_conditioning", "Aire acondicionado"], ["heating", "Calefacción"], ["climate_other", "Otros equipos"]] },
  { title: "Alquiler y condiciones", fields: [["property_type", "Tipo de inmueble"], ["rental_type", "Tipo de alquiler"], ["availability", "Disponibilidad"], ["price_period", "Periodicidad del precio"], ["pets_allowed", "Admite mascotas"], ["smoking_allowed", "Permite fumar"]] },
];

function httpUrl(value: string | null) {
  if (!value) return null;
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}

const ICON_FONT_NOISE = new Set([
  "window_open", "window_closed", "ac_unit", "check", "check_circle",
  "close", "done", "kitchen", "apartment", "home", "bed", "bathtub",
  "elevator", "balcony", "garage", "local_parking", "pets", "smoke_free",
]);

function displayFeature(key: string, value: string | number | boolean | string[]) {
  if (typeof value === "string" && ICON_FONT_NOISE.has(value.trim().toLowerCase())) return "Sí";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (key.endsWith("area_m2")) return `${value} m²`;
  if (key === "energy_consumption_kwh_m2_year") return `${value} kWh/m²·año`;
  if (key === "energy_emissions_kg_m2_year") return `${value} kg CO₂/m²·año`;
  return Array.isArray(value) ? value.join(", ") : String(value);
}

export function PropertyDetails({ propertyId, onClose, onUpdated, onAddNote }: PropertyDetailsProps) {
  const supabase = createClient();
  const [property, setProperty] = useState<Property | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error("Inicia sesión para consultar esta propiedad.");
        const { data, error: queryError } = await supabase.from("properties").select("*").eq("id", propertyId).single();
        if (queryError) throw queryError;
        if (cancelled) return;
        const loaded = { ...data, features: data.features || {} } as Property;
        setProperty(loaded);
        setDraft({ ...loaded, features: { ...loaded.features } });
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error && cause.message.includes("Inicia sesión") ? cause.message : "No encontramos esta propiedad o no tienes acceso a ella.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [propertyId, supabase]);

  useEffect(() => {
    if (!onClose) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", handleKeyDown); previousFocus?.focus(); };
  }, [onClose]);

  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setSaved(false);
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const save = async () => {
    if (!draft || !draft.title.trim()) { setError("El título es obligatorio."); return; }
    if (draft.original_url && !httpUrl(draft.original_url)) { setError("La URL original debe ser http o https."); return; }
    if (draft.image_url && !httpUrl(draft.image_url)) { setError("La URL de la imagen debe ser http o https."); return; }
    setSaving(true); setError(null); setSaved(false);
    const features = Object.fromEntries(Object.entries(draft.features || {}).filter(([, value]) => value !== undefined && value !== null && value !== ""));
    try {
      const { data, error: updateError } = await supabase.from("properties").update({
        title: draft.title.trim(), price: Number.isFinite(draft.price) ? draft.price : null,
        image_url: draft.image_url || null, original_url: draft.original_url || null,
        description: draft.description || null,
        status: draft.status, features,
      }).eq("id", propertyId).select().single();
      if (updateError) throw updateError;
      const updated = { ...data, features: data.features || {} } as Property;
      setProperty(updated); setDraft({ ...updated, features: { ...updated.features } });
      setSaved(true); setEditing(false); onUpdated?.(updated);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "";
      setError(detail.includes("features") ? "Actualiza primero la base de datos con supabase/migrations/20261026_property_features.sql." : "No se pudieron guardar los cambios. Comprueba la conexión e inténtalo otra vez.");
    } finally { setSaving(false); }
  };

  const content = <div ref={dialogRef} tabIndex={-1} role={onClose ? "dialog" : undefined} aria-modal={onClose ? true : undefined} aria-labelledby="property-detail-title" className={onClose ? "relative max-h-[94dvh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-[var(--cp-line)] bg-[var(--cp-paper)] shadow-2xl outline-none dark:border-[var(--cp-line-dark)] dark:bg-[var(--cp-paper-dark)]" : "mx-auto max-w-6xl overflow-hidden rounded-2xl border border-[var(--cp-line)] bg-[var(--cp-paper)] shadow-sm dark:border-[var(--cp-line-dark)] dark:bg-[var(--cp-paper-dark)]"} onClick={(event) => event.stopPropagation()}>
    {(onClose || !onClose) && <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--cp-line)] bg-[var(--cp-paper)]/95 px-4 py-3 backdrop-blur dark:border-[var(--cp-line-dark)] dark:bg-[var(--cp-paper-dark)]/95 sm:px-6"><div className="flex min-w-0 items-center gap-3"><Link href="/dashboard" aria-label="Volver al tablero" className="rounded-lg p-2 text-[var(--cp-muted)] hover:bg-[var(--cp-accent-soft)] dark:text-[var(--cp-muted-dark)] dark:hover:bg-[var(--cp-accent-soft-dark)]"><ArrowLeft className="h-4 w-4" /></Link><h1 id="property-detail-title" className="truncate text-sm font-semibold text-[var(--cp-ink)] dark:text-[var(--cp-ink-dark)]">{property?.title || "Detalle de propiedad"}</h1></div><div className="flex items-center gap-2">{property?.original_url && <a href={httpUrl(property.original_url) || undefined} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--cp-line)] px-2.5 py-2 text-xs font-medium text-[var(--cp-ink)] hover:bg-[var(--cp-accent-soft)] dark:border-[var(--cp-line-dark)] dark:text-[var(--cp-ink-dark)] dark:hover:bg-[var(--cp-accent-soft-dark)]"><ExternalLink className="h-3.5 w-3.5" /><span className="hidden sm:inline">Ver anuncio</span></a>}{!editing && property && <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--cp-accent)] px-2.5 py-2 text-xs font-semibold text-white hover:brightness-95 dark:bg-[var(--cp-accent-dark)] dark:text-[#202824]"><Pencil className="h-3.5 w-3.5" />Editar</button>}{onClose && <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar detalle" className="rounded-lg p-2 text-[var(--cp-muted)] hover:bg-[var(--cp-accent-soft)] dark:text-[var(--cp-muted-dark)] dark:hover:bg-[var(--cp-accent-soft-dark)]"><X className="h-4 w-4" /></button>}</div></header>}
    {loading ? <div className="flex min-h-72 items-center justify-center gap-3 text-sm text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]"><Loader2 className="h-5 w-5 animate-spin" />Cargando la propiedad…</div>
    : error && !property ? <div className="p-8 text-center"><p role="alert" className="text-sm text-red-600">{error}</p>{onClose && <button type="button" onClick={onClose} className="mt-4 rounded-lg border border-[var(--cp-line)] px-3 py-2 text-sm dark:border-[var(--cp-line-dark)]">Cerrar</button>}</div>
    : property && draft && <div className="p-3 sm:p-7">
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      {saved && <p role="status" className="mb-4 inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"><Check className="h-4 w-4" />Cambios guardados correctamente.</p>}
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)]">
        <section>
          {property.image_url ? <div className="overflow-hidden rounded-2xl bg-[var(--cp-surface)] shadow-sm ring-1 ring-black/5 dark:bg-[var(--cp-surface-dark)] dark:ring-white/10"><img src={property.image_url} alt={property.title} className="aspect-[4/3] max-h-[560px] w-full object-cover" /></div> : <div className="grid aspect-[4/3] max-h-[560px] place-items-center rounded-2xl bg-[var(--cp-surface)] dark:bg-[var(--cp-surface-dark)]"><ImageOff className="h-8 w-8 text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]" /></div>}
          {editing ? <div className="mt-4 space-y-3"><Field label="Título"><input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} className={inputClass} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Precio (€)"><input type="number" min="0" value={draft.price ?? ""} onChange={(event) => updateDraft("price", event.target.value ? Number(event.target.value) : null)} className={inputClass} /></Field><Field label="Estado"><select value={draft.status} onChange={(event) => updateDraft("status", event.target.value as PropertyStatus)} className={inputClass}>{Object.entries(STATUS_CONFIG).map(([key, status]) => <option key={key} value={key}>{status.label}</option>)}</select></Field></div><Field label="URL de imagen"><input value={draft.image_url || ""} onChange={(event) => updateDraft("image_url", event.target.value || null)} className={inputClass} /></Field><Field label="URL original"><input value={draft.original_url || ""} onChange={(event) => updateDraft("original_url", event.target.value || null)} className={inputClass} /></Field><Field label="Descripción"><textarea rows={4} value={draft.description || ""} onChange={(event) => updateDraft("description", event.target.value || null)} className={inputClass} /></Field></div>
          : <><div className="mt-5 flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="text-2xl font-semibold leading-tight tracking-tight text-[var(--cp-ink)] dark:text-[var(--cp-ink-dark)]">{property.title}</h2>{property.price !== null && <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--cp-ink)] dark:text-[var(--cp-ink-dark)]">{new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(property.price)}{typeof property.features?.price_period === "string" && <span className="ml-1 text-sm font-normal text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">· {property.features.price_period}</span>}</p>}</div><span className={`mt-1 rounded-full border px-3 py-1.5 text-xs font-medium ${STATUS_CONFIG[property.status].bgColor} ${STATUS_CONFIG[property.status].color}`}>{STATUS_CONFIG[property.status].label}</span></div>{property.description && <p className="mt-5 whitespace-pre-line border-t border-[var(--cp-line)] pt-4 text-sm leading-7 text-[var(--cp-muted)] dark:border-[var(--cp-line-dark)] dark:text-[var(--cp-muted-dark)]">{property.description}</p>}</>}
        </section>
        <section className="space-y-4">
          {editing ? <><div><h2 className="mb-2 text-sm font-semibold text-[var(--cp-ink)] dark:text-[var(--cp-ink-dark)]">Editar características</h2><PropertyFeatureEditor value={draft.features || {}} onChange={(features) => updateDraft("features", features)} /></div><div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => { setDraft({ ...property, features: { ...property.features } }); setEditing(false); setError(null); }} className="rounded-lg border border-[var(--cp-line)] px-3 py-2 text-sm text-[var(--cp-muted)] dark:border-[var(--cp-line-dark)] dark:text-[var(--cp-muted-dark)]">Cancelar</button><button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg bg-[var(--cp-accent)] px-4 py-2 text-sm font-semibold text-white hover:brightness-95 dark:bg-[var(--cp-accent-dark)] dark:text-[#202824] disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Guardar cambios</button></div></>
          : <><FeatureSections features={property.features || {}} /><PersonalNotes propertyId={property.id} onAddNote={onAddNote} /><p className="text-xs text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">Añadido el {new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date(property.created_at))}</p>{httpUrl(property.original_url) && <a href={httpUrl(property.original_url) || undefined} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--cp-accent)] hover:underline dark:text-[var(--cp-accent-dark)]">Visitar anuncio original<ExternalLink className="h-4 w-4" /></a>}</>}
        </section>
      </div>
    </div>}
  </div>;

  if (onClose) return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--cp-overlay)] p-2 backdrop-blur-[2px] sm:p-5" onMouseDown={onClose}><div className="w-full max-w-6xl" onMouseDown={(event) => event.stopPropagation()}>{content}</div></div>, document.body);
  return content;
}

const inputClass = "mt-1 w-full rounded-lg border border-[var(--cp-line)] bg-[var(--cp-surface)] px-3 py-2 text-sm text-[var(--cp-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--cp-accent)] dark:border-[var(--cp-line-dark)] dark:bg-[var(--cp-surface-dark)] dark:text-[var(--cp-ink-dark)]";
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-medium text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">{label}{children}</label>; }

function PersonalNotes({ propertyId, onAddNote }: { propertyId: string; onAddNote?: (id: string, content: string) => Promise<PropertyNote> }) {
  const supabase = createClient();
  const [notes, setNotes] = useState<PropertyNote[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error: queryError } = await supabase.from("property_notes")
        .select("id, property_id, user_id, content, created_at")
        .eq("property_id", propertyId).order("created_at", { ascending: false });
      if (cancelled) return;
      if (queryError) setError("No se pudieron cargar las notas.");
      else setNotes((data ?? []) as PropertyNote[]);
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [propertyId, supabase]);

  const addNote = async () => {
    const content = draft.trim();
    if (!content) return;
    setSaving(true);
    setError(null);
    try {
      let note: PropertyNote;
      if (onAddNote) note = await onAddNote(propertyId, content);
      else {
        const { data, error: insertError } = await supabase.from("property_notes")
          .insert({ property_id: propertyId, content })
          .select("id, property_id, user_id, content, created_at").single();
        if (insertError) throw insertError;
        note = data as PropertyNote;
      }
      setNotes((current) => [note, ...current]);
      setDraft("");
    } catch {
      setError("No se pudo guardar la nota.");
    } finally { setSaving(false); }
  };

  return <section className="rounded-2xl border border-[var(--cp-line)] bg-[var(--cp-surface)] p-5 dark:border-[var(--cp-line-dark)] dark:bg-[var(--cp-surface-dark)]">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><StickyNote className="h-4 w-4 text-[var(--cp-accent)] dark:text-[var(--cp-accent-dark)]" /><h2 className="text-sm font-semibold text-[var(--cp-ink)] dark:text-[var(--cp-ink-dark)]">Notas personales</h2></div><span className="text-xs tabular-nums text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">{notes.length}</span></div>
    <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{loading ? <p className="text-xs text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">Cargando notas…</p> : notes.length ? notes.map((note) => <article key={note.id} className="rounded-lg bg-[var(--cp-paper)] p-3 dark:bg-[#171d1a]"><p className="whitespace-pre-wrap break-words text-sm text-[var(--cp-ink)] dark:text-[var(--cp-ink-dark)]">{note.content}</p><time dateTime={note.created_at} className="mt-2 block text-[11px] text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">{new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(note.created_at))}</time></article>) : <p className="text-xs text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">Todavía no añadiste notas.</p>}</div>
    <label htmlFor={`detail-note-${propertyId}`} className="mt-4 block text-xs font-medium text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">Nueva nota</label><textarea id={`detail-note-${propertyId}`} value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} placeholder="Escribe un detalle para recordar…" className="mt-1.5 w-full resize-y rounded-lg border border-[var(--cp-line)] bg-transparent px-3 py-2.5 text-sm text-[var(--cp-ink)] outline-none placeholder:text-[var(--cp-muted)] focus:border-[var(--cp-accent)] focus:ring-2 focus:ring-[var(--cp-accent)]/20 dark:border-[var(--cp-line-dark)] dark:text-[var(--cp-ink-dark)] dark:placeholder:text-[var(--cp-muted-dark)]" />
    {error && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p>}
    <div className="mt-3 flex justify-end"><button type="button" onClick={() => void addNote()} disabled={saving || !draft.trim()} className="inline-flex items-center gap-2 rounded-lg bg-[var(--cp-accent)] px-3 py-2 text-xs font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[var(--cp-accent-dark)] dark:text-[#202824]">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Guardar nota</button></div>
  </section>;
}

function FeatureSections({ features }: { features: PropertyFeatures }) {
  const valueEntries = (keys: string[]) => keys.map((key) => [key, features[key]] as const).filter((entry): entry is readonly [string, string | number | boolean | string[]] => (entry[1] !== undefined && entry[1] !== null && entry[1] !== "" && !Array.isArray(entry[1]) || Array.isArray(entry[1]) && entry[1].length > 0) && !(entry[0] === "energy_consumption_rating" && features.energy_consumption_kwh_m2_year !== undefined) && !(entry[0] === "energy_emissions_rating" && features.energy_emissions_kg_m2_year !== undefined));
  return <div className="space-y-3">{groups.map((group) => {
    const entries = valueEntries(group.fields.map(([key]) => key));
    if (!entries.length) return null;
    return <section key={group.title} className="rounded-2xl border border-[var(--cp-line)] bg-[var(--cp-surface)] p-5 dark:border-[var(--cp-line-dark)] dark:bg-[var(--cp-surface-dark)]"><h2 className="text-sm font-semibold tracking-tight text-[var(--cp-ink)] dark:text-[var(--cp-ink-dark)]">{group.title}</h2><dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">{entries.map(([key, value]) => <div key={key} className="min-w-0"><dt className="text-[11px] font-medium text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">{group.fields.find(([fieldKey]) => fieldKey === key)?.[1]}</dt><dd className="mt-1 break-words text-sm font-medium leading-5 text-[var(--cp-ink)] dark:text-[var(--cp-ink-dark)]">{displayFeature(key, value)}</dd></div>)}</dl></section>;
  })}{features.raw_details?.length ? <section className="rounded-2xl border border-[var(--cp-line)] bg-[var(--cp-surface)] p-5 dark:border-[var(--cp-line-dark)] dark:bg-[var(--cp-surface-dark)]"><h2 className="text-sm font-semibold text-[var(--cp-ink)] dark:text-[var(--cp-ink-dark)]">Otros datos originales</h2><ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">{features.raw_details.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul></section> : null}</div>;
}
