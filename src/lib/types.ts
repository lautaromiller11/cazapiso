export type PropertyStatus = "guardado" | "contactado" | "visita" | "descartado";

export interface Board {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
}

export interface PropertyNote {
  id: string;
  property_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface Property {
  id: string;
  board_id: string;
  original_url: string | null;
  title: string;
  price: number | null;
  image_url: string | null;
  description: string | null;
  features: PropertyFeatures;
  status: PropertyStatus;
  notes: string | null;
  property_notes?: PropertyNote[];
  created_at: string;
  updated_at: string;
}

export interface PropertyFeatures {
  address?: string;
  bedrooms?: number;
  rooms?: number;
  bathrooms?: number;
  constructed_area_m2?: number;
  usable_area_m2?: number;
  area_m2?: number;
  floor?: string;
  exterior?: boolean;
  balcony?: boolean;
  terrace?: boolean;
  garage_included?: boolean;
  property_condition?: string;
  year_built?: number;
  property_type?: string;
  rental_type?: string;
  price_period?: string;
  availability?: string;
  orientation?: string;
  elevator?: boolean;
  furnished?: boolean;
  kitchen_equipped?: boolean;
  pets_allowed?: boolean;
  smoking_allowed?: boolean;
  heating?: string;
  air_conditioning?: boolean;
  climate_other?: string;
  building_details?: string;
  energy_consumption_rating?: string;
  energy_consumption_kwh_m2_year?: number;
  energy_emissions_rating?: string;
  energy_emissions_kg_m2_year?: number;
  energy_label_url?: string;
  energy_label_image_url?: string;
  energy_certificate_details?: string;
  raw_details?: string[];
  [key: string]: string | number | boolean | string[] | undefined;
}

export interface ExtractedData {
  title: string;
  price: number | null;
  imageUrl: string | null;
  description: string | null;
  originalUrl: string;
  features?: PropertyFeatures;
  success: boolean;
  error?: string;
}

export const STATUS_CONFIG: Record<PropertyStatus, { label: string; color: string; bgColor: string }> = {
  guardado: { label: "Guardado", color: "text-[var(--cp-status-saved)]", bgColor: "bg-[var(--cp-accent-soft)] border-[var(--cp-line)] dark:bg-[var(--cp-accent-soft-dark)] dark:border-[var(--cp-line-dark)]" },
  contactado: { label: "Contactado", color: "text-[var(--cp-status-contacted)]", bgColor: "bg-amber-50/70 border-amber-200/80 dark:bg-amber-950/30 dark:border-amber-900/70" },
  visita: { label: "Visita", color: "text-[var(--cp-status-visit)]", bgColor: "bg-teal-50/70 border-teal-200/80 dark:bg-teal-950/30 dark:border-teal-900/70" },
  descartado: { label: "Descartado", color: "text-[var(--cp-status-discarded)]", bgColor: "bg-gray-100/80 border-gray-200 dark:bg-slate-800 dark:border-slate-700" },
};
