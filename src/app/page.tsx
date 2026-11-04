import Link from "next/link";
import { ArrowRight, Check, ClipboardList, Home, MessageCircle, CalendarDays } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

const steps = [
  { icon: ClipboardList, title: "Guarda anuncios", text: "Añádelos desde la extensión mientras navegas." },
  { icon: MessageCircle, title: "Haz seguimiento", text: "Anota conversaciones y cambia el estado." },
  { icon: CalendarDays, title: "Organiza visitas", text: "Ten cada opción a mano en tu tablero." },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f4f4ed] text-[#28332c] dark:bg-[#171d1a] dark:text-[#eef1e8]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 sm:px-8">
        <header className="flex h-[76px] items-center justify-between border-b border-[#dedfd5] dark:border-[#38423b]">
          <Link href="/" aria-label="CazaPiso, inicio" className="inline-flex items-center">
            <BrandLogo className="h-9 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-[#526257] transition hover:bg-[#e8eee5] hover:text-[#194223] dark:text-[#c2cec0] dark:hover:bg-[#293a30] dark:hover:text-white">Iniciar sesión</Link>
            <ThemeToggle />
          </div>
        </header>

        <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.05fr_.95fr] lg:gap-20 lg:py-24">
          <div className="max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d7dfd3] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#49634d] dark:border-[#384b3d] dark:bg-[#202824] dark:text-[#b9d0b7]">
              <Home className="h-3.5 w-3.5" /> Tu espacio para buscar alquiler
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Encuentra tu próximo piso con todo en orden.</h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#68736a] dark:text-[#a3ada2]">Guarda anuncios, apunta lo que importa y sigue cada conversación desde un solo tablero.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-[#58735f] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#465d4c] dark:bg-[#9ab79c] dark:text-[#18211a] dark:hover:bg-[#b6ccb6]">Abrir mi tablero <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/signup" className="rounded-lg border border-[#d6dbd1] bg-white px-5 py-3 text-sm font-semibold text-[#35453a] transition hover:border-[#9aab98] hover:bg-[#fbfcf8] dark:border-[#38423b] dark:bg-[#202824] dark:text-[#e3e9df] dark:hover:border-[#708674]">Crear cuenta</Link>
            </div>
            <p className="mt-4 text-xs text-[#788178] dark:text-[#929e93]">¿Ya tienes cuenta? <Link href="/login" className="font-semibold text-[#49634d] underline decoration-[#aab9a6] underline-offset-4 hover:text-[#194223] dark:text-[#b9d0b7] dark:hover:text-white">Inicia sesión</Link></p>
          </div>

          <div className="rounded-2xl border border-[#dfe3da] bg-white p-5 shadow-[0_16px_50px_-36px_rgba(28,48,32,.32)] sm:p-7 dark:border-[#38423b] dark:bg-[#202824] dark:shadow-black/20">
            <div className="flex items-start justify-between gap-4 border-b border-[#e8ebe4] pb-5 dark:border-[#38423b]">
              <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#849084] dark:text-[#9aa79b]">Tu búsqueda</p><h2 className="mt-1 text-lg font-semibold">Un proceso más claro</h2></div>
              <span className="rounded-full bg-[#e8eee5] px-2.5 py-1 text-xs font-semibold text-[#49634d] dark:bg-[#293a30] dark:text-[#b9d0b7]">En marcha</span>
            </div>
            <ol className="mt-2 divide-y divide-[#edf0e9] dark:divide-[#38423b]">
              {steps.map(({ icon: Icon, title, text }, index) => (
                <li key={title} className="flex gap-4 py-5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f0f4ed] text-[#58735f] dark:bg-[#293a30] dark:text-[#b9d0b7]"><Icon className="h-[18px] w-[18px]" /></span>
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-sm font-semibold">{title}</span>{index === 0 && <Check className="h-4 w-4 text-[#58735f] dark:text-[#9ab79c]" />}</div><p className="mt-1 text-sm leading-5 text-[#788178] dark:text-[#a3ada2]">{text}</p></div>
                </li>
              ))}
            </ol>
            <div className="mt-1 rounded-xl bg-[#f6f7f2] px-4 py-3 text-xs leading-5 text-[#68736a] dark:bg-[#171d1a] dark:text-[#a3ada2]">Tus anuncios y notas quedan reunidos en un tablero privado.</div>
          </div>
        </section>
        <footer className="border-t border-[#dedfd5] py-4 text-xs text-[#879087] dark:border-[#38423b] dark:text-[#8d998e]">CazaPiso <span className="mx-1">·</span> Tu búsqueda de alquiler, organizada.</footer>
      </div>
    </main>
  );
}
