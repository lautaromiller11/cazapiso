"use client";

import type { PropertyFeatures } from "@/lib/types";

type FeatureKey = string;
type Kind = "text" | "number" | "boolean";
type Field = { key: FeatureKey; label: string; kind: Kind; unit?: string };

const groups: { title: string; fields: Field[] }[] = [
  { title: "Características básicas", fields: [
    { key: "address", label: "Dirección o zona", kind: "text" },
    { key: "constructed_area_m2", label: "Superficie construida", kind: "number", unit: "m²" },
    { key: "usable_area_m2", label: "Superficie útil", kind: "number", unit: "m²" },
    { key: "area_m2", label: "Superficie (sin especificar tipo)", kind: "number", unit: "m²" },
    { key: "bedrooms", label: "Dormitorios", kind: "number" }, { key: "rooms", label: "Habitaciones", kind: "number" },
    { key: "bathrooms", label: "Baños", kind: "number" }, { key: "balcony", label: "Balcón", kind: "boolean" },
    { key: "terrace", label: "Terraza", kind: "boolean" }, { key: "garage_included", label: "Garaje incluido", kind: "boolean" },
    { key: "garage_type", label: "Tipo de garaje", kind: "text" }, { key: "property_age", label: "Antigüedad", kind: "text" },
    { key: "property_condition", label: "Estado del inmueble", kind: "text" }, { key: "orientation", label: "Orientación", kind: "text" },
    { key: "year_built", label: "Año de construcción", kind: "number" }, { key: "furnished", label: "Amueblado", kind: "boolean" },
    { key: "kitchen_equipped", label: "Cocina equipada", kind: "boolean" },
  ] },
  { title: "Edificio", fields: [
    { key: "floor", label: "Planta", kind: "text" }, { key: "exterior", label: "Exterior", kind: "boolean" },
    { key: "elevator", label: "Ascensor", kind: "boolean" }, { key: "building_details", label: "Otros datos del edificio", kind: "text" },
  ] },
  { title: "Equipamiento", fields: [
    { key: "air_conditioning", label: "Aire acondicionado", kind: "boolean" },
    { key: "heating", label: "Calefacción", kind: "text" }, { key: "climate_other", label: "Otros equipos", kind: "text" },
  ] },
  { title: "Alquiler y condiciones", fields: [
    { key: "property_type", label: "Tipo de inmueble", kind: "text" }, { key: "rental_type", label: "Tipo de alquiler", kind: "text" },
    { key: "availability", label: "Disponibilidad", kind: "text" }, { key: "price_period", label: "Periodicidad del precio", kind: "text" },
    { key: "pets_allowed", label: "Admite mascotas", kind: "boolean" }, { key: "smoking_allowed", label: "Permite fumar", kind: "boolean" },
  ] },
];

export function PropertyFeatureEditor({ value, onChange }: { value: PropertyFeatures; onChange: (next: PropertyFeatures) => void }) {
  const update = (key: FeatureKey, next: string | number | boolean | string[] | undefined) => onChange({ ...value, [key]: next });
  return (
    <div className="space-y-3">
      {groups.map((group) => <details key={group.title} className="rounded-lg border border-gray-200 dark:border-slate-700">
        <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-200">{group.title}</summary>
        <div className="grid grid-cols-1 gap-3 px-3 pb-3 sm:grid-cols-2">
          {group.fields.map((field) => <label key={field.key} className="block text-xs font-medium text-gray-600 dark:text-slate-400">{field.label}{field.unit && <span className="ml-1 font-normal text-gray-400">({field.unit})</span>}
            {field.kind === "boolean" ? <select value={typeof value[field.key] === "boolean" ? String(value[field.key]) : ""} onChange={(event) => update(field.key, event.target.value === "" ? undefined : event.target.value === "true")} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"><option value="">Sin especificar</option><option value="true">Sí</option><option value="false">No</option></select>
              : <input type={field.kind === "number" ? "number" : "text"} min={field.kind === "number" ? "0" : undefined} step={field.kind === "number" ? "any" : undefined} value={typeof value[field.key] === "string" || typeof value[field.key] === "number" ? String(value[field.key]) : ""} onChange={(event) => update(field.key, event.target.value === "" ? undefined : field.kind === "number" ? Number(event.target.value) : event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />}
          </label>)}
        </div>
      </details>)}
      <details className="rounded-lg border border-gray-200 dark:border-slate-700"><summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-200">Otros datos originales del anuncio</summary><label className="block px-3 pb-3 text-xs font-medium text-gray-600 dark:text-slate-400">Una característica por línea<textarea value={value.raw_details?.join("\n") || ""} onChange={(event) => update("raw_details", event.target.value.split("\n").map((line) => line.trim()).filter(Boolean))} rows={4} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" /></label></details>
    </div>
  );
}
