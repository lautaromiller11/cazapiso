"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyPreference = () => {
      const saved = localStorage.getItem("cazapisos-theme");
      const dark = saved === "dark" || (saved !== "light" && media.matches);
      setIsDark(dark);
      document.documentElement.dataset.theme = saved === "light" || saved === "dark" ? saved : "system";
      document.documentElement.classList.toggle("dark", dark);
    };

    const timer = window.setTimeout(applyPreference, 0);
    media.addEventListener("change", applyPreference);
    return () => {
      window.clearTimeout(timer);
      media.removeEventListener("change", applyPreference);
    };
  }, []);

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    setIsDark(next === "dark");
    localStorage.setItem("cazapisos-theme", next);
    document.documentElement.dataset.theme = next;
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const Icon = isDark ? Moon : Sun;
  const nextLabel = isDark ? "claro" : "oscuro";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Cambiar a modo ${nextLabel}`}
      aria-pressed={isDark}
      title={`Cambiar a modo ${nextLabel}`}
      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[var(--cp-line)] bg-[var(--cp-surface)] text-[var(--cp-ink)] transition-colors hover:bg-[var(--cp-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cp-accent)] dark:border-[var(--cp-line-dark)] dark:bg-[var(--cp-surface-dark)] dark:text-[var(--cp-ink-dark)] dark:hover:bg-[var(--cp-accent-soft-dark)]"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
