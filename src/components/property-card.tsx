"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ExternalLink, FileText, ImageOff, Loader2, MoreHorizontal, StickyNote, Trash2 } from "lucide-react";
import type { Property, PropertyNote, PropertyStatus } from "@/lib/types";
import { STATUS_CONFIG } from "@/lib/types";
import { PropertyDetails } from "@/components/property-details";

interface PropertyCardProps {
  property: Property;
  onUpdateStatus: (id: string, status: PropertyStatus) => Promise<void>;
  onAddNote: (id: string, content: string) => Promise<PropertyNote>;
  onDelete: (id: string) => Promise<void>;
}

const statuses = Object.keys(STATUS_CONFIG) as PropertyStatus[];
const statusDotColors: Record<PropertyStatus, string> = {
  guardado: "bg-[var(--cp-status-saved)]",
  contactado: "bg-[var(--cp-status-contacted)]",
  visita: "bg-[var(--cp-status-visit)]",
  descartado: "bg-[var(--cp-status-discarded)]",
};
export function PropertyCard({ property, onUpdateStatus, onAddNote, onDelete }: PropertyCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const closeDetails = useCallback(() => setShowDetails(false), []);
  const features = property.features || {};
  const currentStatus = STATUS_CONFIG[property.status];
  const area = features.constructed_area_m2 ?? features.usable_area_m2 ?? features.area_m2;
  const bedrooms = features.bedrooms ?? features.rooms;
  const openSpaces = [typeof area === "number" ? area + " m²" : null,
    typeof bedrooms === "number" ? bedrooms + " hab." : null,
    typeof features.bathrooms === "number" ? features.bathrooms + " baños" : null].filter(Boolean);

  useEffect(() => {
    if (!showActions && !showStatusMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!controlsRef.current?.contains(event.target as Node) && !statusRef.current?.contains(event.target as Node)) {
        setShowActions(false);
        setShowStatusMenu(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowActions(false);
        setShowStatusMenu(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showActions, showStatusMenu]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); } catch { /* The dashboard reports failed operations. */ }
    finally { setBusy(false); }
  };

  return (
    <article className="group/card relative rounded-2xl border border-[var(--cp-line)] bg-[var(--cp-surface)] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[var(--cp-accent)]/60 hover:shadow-lg dark:border-[var(--cp-line-dark)] dark:bg-[var(--cp-surface-dark)] dark:hover:border-[var(--cp-accent-dark)]/50 dark:hover:shadow-black/20">
      <div className="relative aspect-[16/10] overflow-hidden rounded-t-2xl bg-[#e9e9e0] dark:bg-[#303933]">
        {property.image_url && !imgError
          ? <button type="button" onClick={() => setShowDetails(true)} aria-label="Abrir detalle de la propiedad" className="group h-full w-full cursor-pointer">
              <img src={property.image_url} alt={property.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" onError={() => setImgError(true)} />
            </button>
          : <button type="button" onClick={() => setShowDetails(true)} className="grid h-full w-full cursor-pointer place-items-center" aria-label="Abrir detalle de la propiedad"><ImageOff className="h-7 w-7 text-[#9aa095]" /></button>}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" />
        <div ref={controlsRef} className="absolute inset-x-2.5 top-2.5 z-20 flex justify-end opacity-100 transition-opacity duration-200 [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/card:pointer-events-auto [@media(hover:hover)]:group-hover/card:opacity-100 group-focus-within/card:pointer-events-auto group-focus-within/card:opacity-100">
          <div className="flex items-center gap-1">
            {property.original_url && <a href={property.original_url} target="_blank" rel="noopener noreferrer" aria-label="Visitar anuncio original" title="Visitar anuncio original" className="grid h-8 w-8 cursor-pointer place-items-center rounded-md bg-black/50 text-white shadow-sm backdrop-blur-sm transition hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><ExternalLink className="h-3.5 w-3.5" /></a>}
            <button type="button" onClick={() => { setShowNotes((shown) => !shown); setShowActions(false); }} aria-label="Notas personales" title="Notas personales" className={"grid h-8 w-8 cursor-pointer place-items-center rounded-md bg-black/50 text-white shadow-sm backdrop-blur-sm transition hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white " + (property.property_notes?.length ? "ring-1 ring-white/70" : "")}><StickyNote className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => { setShowActions((shown) => !shown); setShowStatusMenu(false); }} aria-label="Más acciones" aria-expanded={showActions} className="grid h-8 w-8 cursor-pointer place-items-center rounded-md bg-black/50 text-white shadow-sm backdrop-blur-sm transition hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><MoreHorizontal className="h-4 w-4" /></button>
            {showActions && <div role="menu" className="absolute right-0 top-9 w-40 rounded-md border border-[var(--cp-line)] bg-[var(--cp-surface)] p-1 shadow-lg dark:border-[var(--cp-line-dark)] dark:bg-[var(--cp-surface-dark)]"><button type="button" role="menuitem" onClick={() => { setShowDeleteConfirm(true); setShowActions(false); }} className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300 dark:hover:bg-red-950/40"><Trash2 className="h-3.5 w-3.5" />Eliminar propiedad</button></div>}
          </div>
        </div>
      </div>

      <div className="p-4 pb-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 min-h-11 text-sm font-semibold leading-5 text-[var(--cp-ink)] dark:text-[var(--cp-ink-dark)]"><button type="button" onClick={() => setShowDetails(true)} className="cursor-pointer text-left hover:text-[var(--cp-accent)] focus-visible:outline-none focus-visible:underline dark:hover:text-[var(--cp-accent-dark)]">{property.title}</button></h3>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          {property.price !== null ? <p className="text-lg font-bold tabular-nums tracking-tight text-[var(--cp-ink)] dark:text-[var(--cp-ink-dark)]">{new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(property.price)}{typeof features.price_period === "string" && <span className="ml-1 text-[11px] font-normal text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">{features.price_period}</span>}</p> : <span />}
          <button type="button" onClick={() => setShowDetails(true)} className="shrink-0 text-[11px] font-semibold text-[var(--cp-accent)] opacity-0 transition-opacity group-hover/card:opacity-100 focus:opacity-100 dark:text-[var(--cp-accent-dark)]">Ver ficha <span aria-hidden="true">→</span></button>
        </div>
        {typeof features.address === "string" && <p className="mt-1.5 truncate text-xs text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">{features.address}</p>}
        {openSpaces.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--cp-line)] pt-3 text-[11px] font-medium text-[var(--cp-ink)] dark:border-[var(--cp-line-dark)] dark:text-[#e4e9e0]">{openSpaces.map((value) => <span key={value} className="rounded-full bg-[#e7e9e1] px-2.5 py-1 dark:bg-[#343d37] dark:text-[#e4e9e0]">{value}</span>)}</div>}
        {showNotes && <div className="absolute inset-0 z-40 grid place-items-center rounded-2xl bg-black/55 p-4 backdrop-blur-[2px]"><div role="dialog" aria-labelledby={"notes-title-" + property.id} aria-modal="true" className="w-full max-w-sm rounded-xl border border-[var(--cp-line)] bg-[var(--cp-surface)] p-4 shadow-2xl dark:border-[var(--cp-line-dark)] dark:bg-[var(--cp-surface-dark)]"><div className="mb-3"><h4 id={"notes-title-" + property.id} className="text-sm font-semibold text-[var(--cp-ink)] dark:text-[var(--cp-ink-dark)]">Notas personales</h4><p className="mt-1 text-xs text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">Cada nota se guarda por separado con su fecha.</p></div><div className="mb-4 max-h-40 space-y-2 overflow-y-auto">{property.property_notes?.length ? property.property_notes.map((note) => <article key={note.id} className="rounded-lg bg-[var(--cp-paper)] p-3 dark:bg-[#171d1a]"><p className="whitespace-pre-wrap break-words text-xs text-[var(--cp-ink)] dark:text-[var(--cp-ink-dark)]">{note.content}</p><time dateTime={note.created_at} className="mt-2 block text-[10px] text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">{new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(note.created_at))}</time></article>) : <p className="rounded-lg bg-[var(--cp-paper)] px-3 py-4 text-center text-xs text-[var(--cp-muted)] dark:bg-[#171d1a] dark:text-[var(--cp-muted-dark)]">Todavía no hay notas. Añade la primera abajo.</p>}</div><label htmlFor={"notes-" + property.id} className="mb-1.5 block text-xs font-medium text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">Nueva nota</label><textarea id={"notes-" + property.id} autoFocus value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Escribe un detalle para recordar..." rows={3} className="w-full resize-y rounded-lg border border-[var(--cp-line)] bg-transparent px-3 py-2.5 text-sm text-[var(--cp-ink)] outline-none placeholder:text-[var(--cp-muted)] focus:border-[var(--cp-accent)] focus:ring-2 focus:ring-[var(--cp-accent)]/20 dark:border-[var(--cp-line-dark)] dark:text-[var(--cp-ink-dark)] dark:placeholder:text-[var(--cp-muted-dark)]" /><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => { setNoteDraft(""); setShowNotes(false); }} className="cursor-pointer rounded-lg px-3 py-2 text-xs font-medium text-[var(--cp-muted)] transition hover:bg-gray-100 dark:text-[var(--cp-muted-dark)] dark:hover:bg-slate-800">Cerrar</button><button type="button" disabled={busy || !noteDraft.trim()} onClick={() => void run(async () => { await onAddNote(property.id, noteDraft); setNoteDraft(""); })} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--cp-accent)] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}Guardar nota</button></div></div></div>}
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--cp-line)] pt-2.5 dark:border-[var(--cp-line-dark)]">
        <div ref={statusRef} className="relative">
          <button type="button" onClick={() => { setShowStatusMenu((open) => !open); setShowActions(false); }} disabled={busy} aria-haspopup="menu" aria-expanded={showStatusMenu} className="inline-flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs font-medium text-[var(--cp-muted)] transition hover:bg-[var(--cp-paper)] hover:text-[var(--cp-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cp-accent)] disabled:cursor-wait dark:text-[var(--cp-muted-dark)] dark:hover:bg-[#303a33] dark:hover:text-[var(--cp-ink-dark)]">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <span aria-hidden="true" className={"h-2 w-2 rounded-full " + statusDotColors[property.status]} />}{currentStatus.label}<ChevronDown aria-hidden="true" className="h-3 w-3 opacity-60" />
          </button>
          {showStatusMenu && <div role="menu" aria-label="Cambiar estado" className="absolute bottom-full left-0 z-30 mb-1.5 w-44 rounded-xl border border-[var(--cp-line)] bg-[var(--cp-surface)] p-1.5 shadow-xl dark:border-[var(--cp-line-dark)] dark:bg-[var(--cp-surface-dark)]">
            {statuses.map((status) => <button key={status} type="button" role="menuitemradio" aria-checked={property.status === status} disabled={busy || property.status === status} onClick={() => { setShowStatusMenu(false); void run(() => onUpdateStatus(property.id, status)); }} className={"flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs hover:bg-[var(--cp-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cp-accent)] disabled:cursor-default disabled:opacity-50 dark:hover:bg-[var(--cp-accent-soft-dark)] " + STATUS_CONFIG[status].color}>
              <span className="inline-flex items-center gap-2"><span aria-hidden="true" className={"h-2 w-2 rounded-full " + statusDotColors[status]} />{STATUS_CONFIG[status].label}</span>{property.status === status && <Check className="h-3.5 w-3.5" />}
            </button>)}
          </div>}
        </div>
          <Link href={"/properties/" + property.id} target="_blank" rel="noopener noreferrer" aria-label="Abrir ficha guardada en otra pestaña" title="Abrir ficha guardada en otra pestaña" className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-[var(--cp-line)] bg-[var(--cp-surface)] text-[var(--cp-accent)] transition hover:border-[var(--cp-accent)] hover:bg-[var(--cp-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cp-accent)] dark:border-[var(--cp-line-dark)] dark:bg-[var(--cp-surface-dark)] dark:text-[var(--cp-accent-dark)] dark:hover:bg-[var(--cp-accent-soft-dark)]"><FileText className="h-4 w-4" /></Link>
        </div>
        {showDeleteConfirm && <div className="absolute inset-0 z-40 grid place-items-center rounded-2xl bg-black/55 p-4 backdrop-blur-[2px]"><div role="alertdialog" aria-label="Confirmar eliminación" aria-modal="true" className="w-full max-w-xs rounded-xl border border-red-200 bg-[var(--cp-surface)] p-4 shadow-2xl dark:border-red-900 dark:bg-[var(--cp-surface-dark)]"><p className="text-sm font-medium text-[var(--cp-ink)] dark:text-[var(--cp-ink-dark)]">¿Eliminar esta propiedad? Esta acción no se puede deshacer.</p><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setShowDeleteConfirm(false)} className="cursor-pointer rounded-lg px-3 py-2 text-xs font-medium text-[var(--cp-muted)] transition hover:bg-gray-100 dark:hover:bg-slate-800">Cancelar</button><button type="button" disabled={busy} onClick={() => void run(async () => { await onDelete(property.id); setShowDeleteConfirm(false); })} className="cursor-pointer rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-800 disabled:cursor-wait disabled:opacity-50">Eliminar</button></div></div></div>}
      </div>
      {showDetails && <PropertyDetails propertyId={property.id} onClose={closeDetails} onAddNote={onAddNote} />}
    </article>
  );
}
