"use client";

import { AlertTriangle, KeyRound, Database, RefreshCw } from "lucide-react";

export function SupabaseSetupGuide() {
  return (
    <div className="mx-auto my-8 max-w-lg rounded-2xl border border-amber-200 bg-white p-6 shadow-sm dark:border-amber-900 dark:bg-slate-900">
      <div className="flex items-center gap-3 text-amber-700 mb-4">
        <div className="p-2 bg-amber-50 rounded-lg">
          <AlertTriangle className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Configuración de Supabase requerida
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Faltan las credenciales de Supabase en tu entorno local
          </p>
        </div>
      </div>

      <p className="mb-5 text-sm text-gray-600 dark:text-slate-300">
        Para comenzar a guardar propiedades y gestionar tus tableros, conecta CazaPiso con tu proyecto de Supabase:
      </p>

      <ol className="mb-6 space-y-4 text-xs text-gray-700 dark:text-slate-300">
        <li className="flex gap-3 items-start">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-semibold shrink-0">
            1
          </span>
          <div>
            <strong className="block text-gray-900 dark:text-white">Crea tu proyecto en Supabase</strong>
            Ingresa a <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">supabase.com</a> y crea un nuevo proyecto.
          </div>
        </li>

        <li className="flex gap-3 items-start">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-semibold shrink-0">
            2
          </span>
          <div>
            <strong className="flex items-center gap-1.5 text-gray-900 dark:text-white">
              <Database className="h-3.5 w-3.5 text-gray-500" />
              Ejecuta el script SQL
            </strong>
            Ve al <strong>SQL Editor</strong> en el panel de Supabase y copia/pega el contenido del archivo:
            <code className="mt-1 block rounded bg-gray-100 p-2 font-mono text-[11px] text-gray-800 dark:bg-slate-800 dark:text-slate-200">
              supabase/schema.sql
            </code>
          </div>
        </li>

        <li className="flex gap-3 items-start">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-semibold shrink-0">
            3
          </span>
          <div>
            <strong className="flex items-center gap-1.5 text-gray-900 dark:text-white">
              <KeyRound className="h-3.5 w-3.5 text-gray-500" />
              Crea tu archivo .env.local
            </strong>
            En la raíz del proyecto local, crea un archivo llamado <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">.env.local</code> con tus variables (ver <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">.env.example</code>):
            <div className="mt-1.5 p-2.5 bg-gray-900 text-green-400 font-mono text-[11px] rounded-lg">
              <div>NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co</div>
              <div>NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui</div>
            </div>
          </div>
        </li>

        <li className="flex gap-3 items-start">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-semibold shrink-0">
            4
          </span>
          <div>
              <strong className="flex items-center gap-1.5 text-gray-900 dark:text-white">
              <RefreshCw className="h-3.5 w-3.5 text-gray-500" />
              Reinicia el servidor local
            </strong>
            Reinicia el servidor de Next.js (<code className="bg-gray-100 px-1 py-0.5 rounded font-mono">npm run dev</code>) y recarga esta página.
          </div>
        </li>
      </ol>

      <button
        onClick={() => window.location.reload()}
            className="w-full rounded-xl bg-gray-900 py-2.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 dark:bg-blue-600 dark:hover:bg-blue-500"
      >
        Recargar página
      </button>
    </div>
  );
}

