import type { Metadata } from "next";
import "./globals.css";
import { AppFooter } from "@/components/app-footer";

export const metadata: Metadata = {
  title: { default: "CazaPiso", template: "%s · CazaPiso" },
  description: "Tu tablero personal para organizar anuncios de alquiler.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{const t=localStorage.getItem('cazapisos-theme')||'system';const d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=t;document.documentElement.classList.toggle('dark',d)}catch{}` }} />
      </head>
      <body className="flex min-h-screen flex-col bg-[var(--cp-paper)] font-sans text-[var(--cp-ink)] antialiased selection:bg-emerald-100 selection:text-emerald-950 dark:bg-[var(--cp-paper-dark)] dark:text-[var(--cp-ink-dark)] dark:selection:bg-emerald-900 dark:selection:text-emerald-50">
        <div className="flex-1">{children}</div>
        <AppFooter />
      </body>
    </html>
  );
}

