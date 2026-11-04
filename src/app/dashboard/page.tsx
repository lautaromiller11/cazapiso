"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, LogOut, Puzzle, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SupabaseSetupGuide } from "@/components/supabase-setup-guide";
import { KanbanBoard } from "@/components/kanban-board";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import type { Board, Property, PropertyNote, PropertyStatus } from "@/lib/types";

export default function DashboardPage() {
  const [isConfigured] = useState(() => isSupabaseConfigured());
  const [board, setBoard] = useState<Board | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(() => isSupabaseConfigured());
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const pendingStatus = useRef(new Set<string>());
  const router = useRouter();
  const supabase = createClient();

  const showToast = useCallback((text: string, kind: "success" | "error" = "success") => {
    setToast({ text, kind });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    const flash = sessionStorage.getItem("cazapisos-flash");
    if (flash) {
      sessionStorage.removeItem("cazapisos-flash");
      const timer = window.setTimeout(() => showToast(flash), 0);
      return () => window.clearTimeout(timer);
    }
  }, [showToast]);

  useEffect(() => {
    if (!isConfigured) return;
    let cancelled = false;
    async function fetchData() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (cancelled) return;
        if (!user) { router.replace("/login?next=%2Fdashboard"); return; }

        const { data: boards, error: boardError } = await supabase
          .from("boards").select("*").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1);
        if (boardError) throw boardError;
        if (cancelled) return;
        let currentBoard = boards?.[0] as Board | undefined;
        if (!currentBoard) {
          const { data, error: createError } = await supabase.from("boards").insert({ user_id: user.id, title: "Mi búsqueda" }).select().single();
          if (createError) throw createError;
          currentBoard = data as Board;
        }
        if (cancelled) return;
        setBoard(currentBoard);
        const { data: rows, error: propertiesError } = await supabase
          .from("properties").select("*").eq("board_id", currentBoard.id).order("created_at", { ascending: false });
        if (propertiesError) throw propertiesError;
        if (cancelled) return;
        const propertyRows = rows ?? [];
        const noteRows: PropertyNote[] = [];
        if (propertyRows.length) {
          const { data: notes, error: notesError } = await supabase
            .from("property_notes").select("id, property_id, user_id, content, created_at")
            .in("property_id", propertyRows.map((row) => row.id)).order("created_at", { ascending: false });
          if (notesError) throw notesError;
          noteRows.push(...((notes ?? []) as PropertyNote[]));
        }
        const notesByProperty = new Map<string, PropertyNote[]>();
        for (const note of noteRows) notesByProperty.set(note.property_id, [...(notesByProperty.get(note.property_id) || []), note]);
        setProperties(propertyRows.map((row) => ({ ...row, features: row.features || {}, property_notes: notesByProperty.get(row.id) || [] })) as Property[]);
        setError(null);
      } catch (cause) {
        if (cancelled) return;
        console.error("Dashboard load failed:", cause);
        setError("No pudimos recuperar tus propiedades. Comprueba la conexión e inténtalo otra vez.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void fetchData();
    return () => { cancelled = true; };
  }, [supabase, router, isConfigured, refreshCount]);

  const handleUpdateStatus = async (id: string, status: PropertyStatus) => {
    if (pendingStatus.current.has(id)) return;
    const previous = properties.find((property) => property.id === id);
    if (!previous || previous.status === status) return;
    pendingStatus.current.add(id);
    setProperties((current) => current.map((property) => property.id === id ? { ...property, status } : property));
    try {
      const { data, error: updateError } = await supabase.from("properties").update({ status }).eq("id", id).select().single();
      if (updateError) throw updateError;
      setProperties((current) => current.map((property) => property.id === id ? { ...property, ...data, features: data.features || property.features || {} } as Property : property));
      showToast("Estado actualizado");
    } catch (cause) {
      setProperties((current) => current.map((property) => property.id === id ? { ...property, status: previous.status } : property));
      showToast("No se pudo actualizar el estado. Se restauró el anterior.", "error");
      throw cause;
    } finally { pendingStatus.current.delete(id); }
  };

  const handleAddNote = async (id: string, content: string) => {
    const { data, error: insertError } = await supabase.from("property_notes")
      .insert({ property_id: id, content: content.trim() })
      .select("id, property_id, user_id, content, created_at").single();
    if (insertError) { showToast("No se pudo guardar la nota.", "error"); throw insertError; }
    const note = data as PropertyNote;
    setProperties((current) => current.map((property) => property.id === id
      ? { ...property, property_notes: [note, ...(property.property_notes || [])] }
      : property));
    showToast("Nota guardada");
    return note;
  };

  const handleDelete = async (id: string) => {
    const { error: deleteError } = await supabase.from("properties").delete().eq("id", id).select("id").single();
    if (deleteError) { showToast("No se pudo eliminar la propiedad.", "error"); throw deleteError; }
    setProperties((current) => current.filter((property) => property.id !== id));
    showToast("Propiedad eliminada");
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) { setLoggingOut(false); showToast("No se pudo cerrar la sesión.", "error"); return; }
    router.replace("/login?closed=1");
    router.refresh();
  };

  if (!isConfigured) return <main className="mx-auto min-h-[70vh] max-w-3xl px-4 py-10"><Brand /><SupabaseSetupGuide /></main>;
  if (loading) return (
    <main className="min-h-screen bg-[var(--cp-paper)] px-4 text-[var(--cp-ink)] dark:bg-[var(--cp-paper-dark)] dark:text-[var(--cp-ink-dark)] sm:px-6">
      <header className="mx-auto flex h-16 max-w-[1600px] items-center justify-between border-b border-[var(--cp-line)] dark:border-[var(--cp-line-dark)]">
        <Brand />
        <ThemeToggle />
      </header>
      <section className="mx-auto max-w-5xl py-12 sm:py-16" aria-live="polite" aria-busy="true">
        <div className="flex items-start gap-4 rounded-2xl border border-[var(--cp-line)] bg-[var(--cp-surface)] p-5 shadow-sm sm:p-6 dark:border-[var(--cp-line-dark)] dark:bg-[var(--cp-surface-dark)]">
          <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--cp-accent-soft)] text-[var(--cp-accent)] dark:bg-[var(--cp-accent-soft-dark)]">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">Preparando tu tablero</p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight">Cargando tus propiedades</h1>
            <p className="mt-1 text-sm text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">Estamos reuniendo tus anuncios y notas.</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--cp-accent-soft)] dark:bg-[var(--cp-accent-soft-dark)]"><div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--cp-accent)]" /></div>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="overflow-hidden rounded-2xl border border-[var(--cp-line)] bg-[var(--cp-surface)] p-4 dark:border-[var(--cp-line-dark)] dark:bg-[var(--cp-surface-dark)]">
              <div className="h-32 animate-pulse rounded-xl bg-[var(--cp-accent-soft)] dark:bg-[var(--cp-accent-soft-dark)]" />
              <div className="mt-4 h-4 w-4/5 animate-pulse rounded bg-[var(--cp-accent-soft)] dark:bg-[var(--cp-accent-soft-dark)]" />
              <div className="mt-3 h-3 w-2/5 animate-pulse rounded bg-[var(--cp-accent-soft)] dark:bg-[var(--cp-accent-soft-dark)]" />
              <div className="mt-5 flex gap-2"><div className="h-7 w-16 animate-pulse rounded-full bg-[var(--cp-accent-soft)] dark:bg-[var(--cp-accent-soft-dark)]" /><div className="h-7 w-20 animate-pulse rounded-full bg-[var(--cp-accent-soft)] dark:bg-[var(--cp-accent-soft-dark)]" /></div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
  if (error) return <div className="flex min-h-[70vh] items-center justify-center px-4"><div className="max-w-md rounded-xl border border-red-200 bg-white p-6 text-center dark:border-red-900 dark:bg-slate-900"><AlertCircle className="mx-auto h-7 w-7 text-red-500" /><p className="mt-3 text-sm text-gray-700 dark:text-slate-200">{error}</p><button onClick={() => { setLoading(true); setError(null); setRefreshCount((count) => count + 1); }} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white dark:bg-blue-600"><RefreshCw className="h-4 w-4" />Reintentar</button></div></div>;

  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-[var(--cp-line)] bg-[var(--cp-paper)]/95 backdrop-blur dark:border-[var(--cp-line-dark)] dark:bg-[var(--cp-paper-dark)]/95">
        <nav aria-label="Navegación principal" className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Brand />
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <button onClick={handleLogout} disabled={loggingOut} title="Cerrar sesión" className="ml-1 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-red-950/30 dark:hover:text-red-400 sm:text-sm">{loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}<span className="hidden sm:inline">Salir</span></button>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <section className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--cp-line)] pb-4 dark:border-[var(--cp-line-dark)]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--cp-accent)]">Seguimiento de b&uacute;squeda</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--cp-ink)] dark:text-[var(--cp-ink-dark)]">{board?.title || "Mi b\u00fasqueda"}</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]"><span className="font-semibold tabular-nums text-[var(--cp-ink)] dark:text-[var(--cp-ink-dark)]">{properties.length}</span> {properties.length === 1 ? "propiedad" : "propiedades"}</p>
            <span className="h-5 w-px bg-[var(--cp-line)] dark:bg-[var(--cp-line-dark)]" aria-hidden="true" />
            <p className="hidden items-center gap-1.5 text-xs text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)] sm:flex"><Puzzle className="h-3.5 w-3.5" />A&ntilde;ade anuncios desde la extensi&oacute;n</p>
          </div>
        </section>
        <div className="flex items-end justify-between gap-3">
          <div><h2 className="text-sm font-semibold text-[var(--cp-ink)] dark:text-[var(--cp-ink-dark)]">Propiedades por estado</h2><p className="mt-0.5 text-xs text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">Arrastra una ficha para cambiar su seguimiento.</p></div>
        </div>
        {properties.length === 0 ? <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-[var(--cp-line)] bg-[var(--cp-paper)] text-center dark:border-[var(--cp-line-dark)] dark:bg-[var(--cp-paper-dark)]"><div className="max-w-sm px-6"><Puzzle className="mx-auto h-6 w-6 text-[var(--cp-accent)]" /><h2 className="mt-3 text-sm font-semibold text-[var(--cp-ink)] dark:text-[var(--cp-ink-dark)]">Tu b&uacute;squeda empieza con un anuncio</h2><p className="mt-1 text-sm text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">Abre Idealista o Fotocasa y usa la extensi&oacute;n de CazaPiso para guardarlo aqu&iacute;.</p></div></div>
          : <KanbanBoard properties={properties} onStatusChange={handleUpdateStatus} onAddNote={handleAddNote} onDelete={handleDelete} />}
      </main>
      {toast && <div role={toast.kind === "error" ? "alert" : "status"} className={`fixed bottom-5 left-1/2 z-40 flex w-[min(calc(100vw-2rem),24rem)] -translate-x-1/2 items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-xl sm:left-auto sm:right-6 sm:translate-x-0 ${toast.kind === "error" ? "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/90 dark:text-red-100" : "border-[var(--cp-accent)]/30 bg-[var(--cp-surface)] text-[var(--cp-ink)] dark:border-[var(--cp-accent-dark)]/30 dark:bg-[var(--cp-surface-dark)] dark:text-[var(--cp-ink-dark)]"}`}>
        {toast.kind === "error" ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--cp-accent)] dark:text-[var(--cp-accent-dark)]" />}
        <div className="min-w-0"><p className="text-sm font-semibold">{toast.text}</p>{toast.text === "Notas guardadas" && <p className="mt-0.5 text-xs text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">Los cambios ya están actualizados en esta propiedad.</p>}</div>
      </div>}
    </div>
  );
}

function Brand() { return <a href="/dashboard" aria-label="CazaPiso" className="inline-flex cursor-pointer items-center"><BrandLogo className="h-9 w-auto" /></a>; }
