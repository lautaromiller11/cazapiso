"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SupabaseSetupGuide } from "@/components/supabase-setup-guide";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Mail, Lock, AlertCircle } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";

export default function LoginPage() {
  const [isConfigured] = useState(() => isSupabaseConfigured());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("closed") === "1") {
      const timer = window.setTimeout(() => setNotice("Sesi\u00f3n cerrada correctamente."), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  if (!isConfigured) {
    return (
      <main className="flex min-h-screen flex-col bg-[#f4f4ed] p-5 text-[#28332c] dark:bg-[#171d1a] dark:text-[#eef1e8]">
        <header className="mx-auto flex h-[68px] w-full max-w-6xl items-center justify-between border-b border-[#dedfd5] dark:border-[#38423b]"><Link href="/" aria-label="CazaPiso, inicio"><BrandLogo className="h-8 w-auto" /></Link><ThemeToggle /></header>
        <div className="flex flex-1 items-center justify-center py-12"><div className="w-full max-w-md rounded-2xl border border-[#dfe3da] bg-white p-6 shadow-[0_18px_60px_-38px_rgba(28,48,32,.35)] sm:p-8 dark:border-[#38423b] dark:bg-[#202824] dark:shadow-black/20"><SupabaseSetupGuide /></div></div>
      </main>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setError(/invalid login credentials/i.test(error.message) ? "El email o la contraseña no son correctos." : error.message);
        return;
      }

      sessionStorage.setItem("cazapisos-flash", "Sesión iniciada correctamente.");
      const requested = new URLSearchParams(window.location.search).get("next");
      const destination = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";
      router.replace(destination);
      router.refresh();
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#f4f4ed] p-5 text-[#28332c] dark:bg-[#171d1a] dark:text-[#eef1e8]">
      <header className="mx-auto flex h-[68px] w-full max-w-6xl items-center justify-between border-b border-[#dedfd5] dark:border-[#38423b]"><Link href="/" aria-label="CazaPiso, inicio"><BrandLogo className="h-8 w-auto" /></Link><ThemeToggle /></header>
      <div className="flex flex-1 flex-col items-center justify-center py-12">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#849084] dark:text-[#9aa79b]">CUENTA</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Inicia sesión</h1>
          <p className="mt-2 text-sm leading-6 text-[#788178] dark:text-[#a3ada2]">Continúa con tus anuncios, notas y visitas.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5 rounded-2xl border border-[#dfe3da] bg-white p-6 shadow-[0_18px_60px_-38px_rgba(28,48,32,.35)] sm:p-8 dark:border-[#38423b] dark:bg-[#202824] dark:shadow-black/20">
          {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">{notice}</p>}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#35453a] dark:text-[#dfe7dc]">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="email"
                type="email"
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
                className="w-full rounded-xl border border-[#d9ded5] bg-[#fcfcf9] py-3 pl-10 pr-4 text-sm text-[#28332c] placeholder:text-[#a0a99f] focus:border-[#8ba08a] focus:outline-none focus:ring-4 focus:ring-[#58735f]/10 dark:border-[#445047] dark:bg-[#171d1a] dark:text-[#eef1e8]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#35453a] dark:text-[#dfe7dc]">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="password"
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-xl border border-[#d9ded5] bg-[#fcfcf9] py-3 pl-10 pr-4 text-sm text-[#28332c] placeholder:text-[#a0a99f] focus:border-[#8ba08a] focus:outline-none focus:ring-4 focus:ring-[#58735f]/10 dark:border-[#445047] dark:bg-[#171d1a] dark:text-[#eef1e8]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#58735f] py-3 text-sm font-semibold text-white transition hover:bg-[#465d4c] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#9ab79c] dark:text-[#18211a] dark:hover:bg-[#b6ccb6]"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Iniciar sesión
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[#788178] dark:text-[#a3ada2]">
          ¿No tienes cuenta?{" "}
          <Link href="/signup" className="font-semibold text-[#49634d] underline decoration-[#aab9a6] underline-offset-4 hover:text-[#194223] dark:text-[#b9d0b7] dark:hover:text-white">
            Regístrate
          </Link>
        </p>
      </div>
      </div>
    </main>
  );
}
