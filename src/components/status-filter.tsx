"use client";

import type { PropertyStatus } from "@/lib/types";
import { STATUS_CONFIG } from "@/lib/types";

interface StatusFilterProps {
  active: PropertyStatus | "all";
  onChange: (status: PropertyStatus | "all") => void;
  counts: Record<PropertyStatus | "all", number>;
}

export function StatusFilter({ active, onChange, counts }: StatusFilterProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
      <button
        onClick={() => onChange("all")}
        className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
          active === "all"
            ? "bg-gray-900 text-white border-gray-900"
            : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
        }`}
      >
        Todos ({counts.all})
      </button>
      {(Object.keys(STATUS_CONFIG) as PropertyStatus[]).map((status) => {
        const config = STATUS_CONFIG[status];
        return (
          <button
            key={status}
            onClick={() => onChange(status)}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              active === status
                ? `${config.bgColor} ${config.color}`
            : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
            }`}
          >
            {config.label} ({counts[status]})
          </button>
        );
      })}
    </div>
  );
}
