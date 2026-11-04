"use client";

import { useState } from "react";
import { House } from "lucide-react";
import { PropertyCard } from "@/components/property-card";
import { STATUS_CONFIG } from "@/lib/types";
import type { DragEvent } from "react";
import type { Property, PropertyNote, PropertyStatus } from "@/lib/types";

interface KanbanBoardProps {
  properties: Property[];
  onStatusChange: (id: string, status: PropertyStatus) => Promise<void>;
  onAddNote: (id: string, content: string) => Promise<PropertyNote>;
  onDelete: (id: string) => Promise<void>;
}

const statuses = Object.keys(STATUS_CONFIG) as PropertyStatus[];

export function KanbanBoard({ properties, onStatusChange, onAddNote, onDelete }: KanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<PropertyStatus | null>(null);

  const finishDrop = (event: DragEvent<HTMLElement>, status: PropertyStatus) => {
    event.preventDefault();
    setDropTarget(null);
    const propertyId = event.dataTransfer.getData("text/plain");
    setDraggingId(null);
    if (!propertyId) return;
    const property = properties.find((item) => item.id === propertyId);
    if (property && property.status !== status) void onStatusChange(property.id, status).catch(() => {});
  };

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
      <div className="grid w-max auto-cols-[minmax(280px,84vw)] grid-flow-col items-start gap-3 sm:w-full sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-2 xl:grid-cols-4">
        {statuses.map((status) => {
          const config = STATUS_CONFIG[status];
          const columnProperties = properties.filter((property) => property.status === status);
          const isDropTarget = dropTarget === status;
          return (
            <section
              key={status}
              aria-label={`${config.label}, ${columnProperties.length} propiedades`}
              onDragEnter={(event) => { event.preventDefault(); if (draggingId) setDropTarget(status); }}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; if (dropTarget !== status) setDropTarget(status); }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget((current) => current === status ? null : current); }}
              onDrop={(event) => finishDrop(event, status)}
              className={`min-h-[220px] rounded-xl p-3 transition-colors duration-150 ${isDropTarget ? "bg-[var(--cp-accent-soft)] ring-2 ring-[var(--cp-accent)]/30 dark:bg-[var(--cp-accent-soft-dark)]" : "bg-[#edeee7] dark:bg-[#1c2420]"}`}
            >
              <header className="mb-2.5 flex items-center justify-between border-b border-[var(--cp-line)] px-1 pb-2 dark:border-[var(--cp-line-dark)]"><h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--cp-ink)] dark:text-[var(--cp-ink-dark)]">{config.label}</h3><span className="font-mono text-xs tabular-nums text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]">{String(columnProperties.length).padStart(2, "0")}</span></header>
              <div className="min-h-24 space-y-2">
                {columnProperties.map((property) => (
                  <div
                    key={property.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", property.id);
                      setDraggingId(property.id);
                    }}
                    onDragEnd={() => { setDraggingId(null); setDropTarget(null); }}
                    className={`cursor-grab rounded-lg transition-opacity active:cursor-grabbing ${draggingId === property.id ? "opacity-40" : "opacity-100"}`}
                  >
                    <PropertyCard property={property} onUpdateStatus={onStatusChange} onAddNote={onAddNote} onDelete={onDelete} />
                  </div>
                ))}
                {columnProperties.length === 0 && <div className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg px-3 py-5 text-center text-xs transition-colors ${isDropTarget ? "text-[var(--cp-accent)] dark:text-[var(--cp-accent-dark)]" : "text-[var(--cp-muted)] dark:text-[var(--cp-muted-dark)]"}`}><House aria-hidden="true" className="h-6 w-6 opacity-60" strokeWidth={1.5} /><span>{isDropTarget ? "Suelta aquí" : "Sin propiedades en este estado"}</span></div>}
              </div>
              {draggingId && <p className="mt-2 text-center text-[10px] text-gray-400 dark:text-slate-500">Suelta una tarjeta para cambiar su estado</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
