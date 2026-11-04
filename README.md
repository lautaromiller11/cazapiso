# CazaPiso 🏠

**CazaPiso** es un tablero personal para organizar anuncios de alquiler. Permite guardar enlaces, revisar los datos extraídos, clasificar propiedades por estado y registrar notas de seguimiento.

---

## 🛠️ Stack Tecnológico

- **Frontend & Backend**: Next.js 16 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS (Mobile-First, diseño minimalista inspirado en Notion y Linear)
- **Iconos**: Lucide React
- **Base de datos & Auth**: Supabase (PostgreSQL con Row Level Security + Supabase Auth con SSR)
- **Web Scraping & Extracción**: Cheerio con protección contra SSRF y límites de payload
- **Despliegue recomendado**: Vercel

---

## 🚀 Puesta en marcha local

### 1. Clonar el repositorio e instalar dependencias

```bash
cd CazaPisos
npm install
```

### 2. Configurar variables de entorno

Copia la plantilla `.env.example` en un archivo `.env.local`:

```bash
cp .env.example .env.local
```

Rellena las variables con tus credenciales de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

Opcionalmente, para que el extractor intente obtener páginas que bloquean el acceso directo, crea una cuenta en [ScrapingBee](https://www.scrapingbee.com/) y añade su API key a `.env.local`:

```env
SCRAPINGBEE_API_KEY=tu-api-key-de-scrapingbee
```

La aplicación primero intenta acceder directamente al anuncio. Si falla o detecta una página de bloqueo, usa ScrapingBee con renderizado JavaScript. Este servicio puede consumir créditos y no garantiza que todos los portales permitan la extracción. La clave se usa solo en el servidor y no debe llevar el prefijo `NEXT_PUBLIC_`.

Si el portal todavía bloquea el contenido y tu plan de ScrapingBee lo permite, puedes activar `SCRAPINGBEE_PREMIUM_PROXY=true` en `.env.local`. Con renderizado JavaScript, la documentación del proveedor indica un costo de 25 créditos por solicitud; déjalo desactivado si no quieres ese consumo.

### 3. Configurar la base de datos en Supabase

1. Crea un proyecto en [Supabase](https://supabase.com).
2. Entra en el panel de tu proyecto y dirígete al menú **SQL Editor**.
3. Abre el archivo `supabase/schema.sql` de este proyecto, copia todo su contenido y ejecútalo con **Run**.
4. Este script configurará:
   - Tabla `boards` (tableros de búsqueda).
   - Tabla `properties` (anuncios inmobiliarios guardados).
   - Tabla `property_notes` (notas independientes con fecha para cada anuncio).
   - Enum `property_status` (`guardado`, `contactado`, `visita`, `descartado`).
   - Índices de rendimiento por `user_id`, `board_id` y `status`.
   - **Row Level Security (RLS)** estricto: ningún usuario puede ver, crear, editar o borrar tableros ni propiedades que no le pertenezcan.
   - Trigger automático para la columna `updated_at`.

Si ya tienes CazaPiso instalado en Supabase, ejecuta también `supabase/migrations/20261026_property_features.sql` para agregar el campo opcional de características. La migración conserva todas las propiedades existentes. Para guardar varias notas con fecha por anuncio, ejecuta tambien `supabase/migrations/20261026_property_notes.sql`; traslada las notas existentes con una fecha aproximada.

El tablero ofrece vistas de lista y Kanban sobre las mismas propiedades de Supabase, con arrastre entre columnas y selector móvil de estado. El botón de tema está en la barra superior y alterna directamente entre modo claro y oscuro; si no hay una preferencia guardada, sigue el tema del sistema. Al abrir una propiedad se muestra un detalle editable; también se puede abrir en una pestaña propia en `/properties/[id]`, protegido por la autenticación y las políticas RLS de Supabase.

La extracción rellena las características que el portal exponga mediante JSON-LD, microdatos, tablas o listas de datos. Los valores no detectados quedan vacíos y se pueden completar desde el formulario de captura o el detalle de la propiedad.

### 4. Iniciar el servidor de desarrollo

```bash
npm run dev
```

Abre tu navegador en [http://localhost:3000](http://localhost:3000).

### Extensión local para guardar desde el navegador

1. Abre `chrome://extensions` (Chrome) o `edge://extensions` (Edge) y activa **Modo de desarrollador**.
2. Pulsa **Cargar descomprimida** y selecciona la carpeta `extensions/cazapisos-local`.
3. En las opciones del popup, configura la URL y la clave pública anon de Supabase desde `.env.local` o el panel de Supabase. No uses una clave `service_role`.
4. Inicia sesión una vez con la misma cuenta que usas en CazaPiso.
5. Abre un anuncio, pulsa el icono de la extensión, elige **Detectar datos del anuncio**, revisa los datos y pulsa **Guardar este anuncio**.

El anuncio se guarda directamente en Supabase y el popup muestra la confirmación; no abre ni cambia ninguna pestaña al guardar. **Editar en CazaPiso** abre el tablero solo cuando lo pulsas. La extensión solo analiza la pestaña activa cuando eliges **Detectar datos del anuncio**. También detecta y guarda las características visibles del anuncio; puedes revisarlas en el bloque desplegable del popup antes de guardar. Si el anuncio no está cargado en el navegador (por ejemplo, muestra un CAPTCHA), puedes completar los campos manualmente.

---

## 📱 Flujo de Usuario y Funcionalidades

1. **Magic Input (Extracción y Registro)**:
   - Pega el enlace de un anuncio en el input principal.
   - La API (`/api/extract`) consulta la URL priorizando metadatos Open Graph (`og:title`, `og:image`, `og:description`), JSON-LD estructurado (`Product`, `RealEstateListing`) y selectores convencionales de precio en euros.
   - Incluye protección completa contra SSRF (bloqueo de IPs privadas, subredes locales y protocolos no HTTP/HTTPS), límites de tiempo (timeout de 10s) y límite de descarga (5MB).
   - Si un portal bloquea la petición (p. ej. Cloudflare o antibot), la aplicación permite continuar introduciendo o editando los datos manualmente sin bloquear al usuario.
   - El usuario previsualiza y confirma siempre antes de guardar.
2. **Dashboard de búsqueda**:
   - Tablero predeterminado creado automáticamente ("Mi búsqueda").
   - Tarjetas visuales con fotografía, título, precio formateado en euros, enlace directo al anuncio original y menú de opciones.
   - Filtros por estado con contador en tiempo real (`Todos`, `Guardado`, `Contactado`, `Visita`, `Descartado`).
3. **Gestión de Estados y Notas**:
   - Cambio de estado instantáneo con persistencia directa en Supabase.
   - Panel de notas desplegable por propiedad para apuntar observaciones de llamadas o visitas.
   - Confirmación modal antes de eliminar propiedades.
4. **Autenticación segura**:
   - Registro e inicio de sesión con Supabase Auth vía email y contraseña.
   - Middleware de Next.js para refresco de sesiones y protección de rutas.
   - Si las credenciales no están configuradas, se muestra una guía visual interactiva sin romper la navegación.

---

## 🔒 Decisiones Arquitectónicas y de Seguridad

1. **Row Level Security en Cascada**:
   - Las propiedades no confían en ningún `user_id` enviado desde el cliente; verifican la propiedad del usuario a través de una cláusula `EXISTS` sobre el `board_id` y `auth.uid()`.
2. **Protección contra SSRF en `/api/extract`**:
   - Se validan protocolos estrictamente `http` y `https`.
   - Se bloquea la resolución a `localhost`, `127.0.0.1`, `::1`, IPs privadas (10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x) y dominios `.local` / `.internal`.
3. **Imágenes Externas**:
   - Dado que los anuncios provienen de infinidad de dominios de portales (Idealista, Fotocasa, inmobiliarias locales), se emplean etiquetas `<img>` con fallback a icono si la imagen falla o caduca, evitando que la aplicación rompa por restricciones de dominios en Next/Image.
4. **Degradación Elegante (Graceful Degradation)**:
   - El backend de extracción es tolerante a fallos: devuelve `success: false` con mensaje descriptivo y la interfaz permite completar los campos manualmente con un solo toque.

---

## Despliegue en Cloudflare Workers

La aplicación necesita funciones de servidor (Supabase SSR y `/api/extract`), así que se despliega como Worker con OpenNext. Requiere Node.js 20. Para desarrollar localmente, `npm run dev` sigue usando Next.js.

1. Crea una cuenta en Cloudflare e inicia sesión en el proyecto con `npx wrangler login`.
2. Configura las variables para el build y el Worker. En Cloudflare Workers > Settings > Variables and Secrets añade `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Añade `SCRAPINGBEE_API_KEY` solo si usas ese servicio. Para un build local, ponlas en `.env.local` (ignorado por Git).
3. Ejecuta `npm run preview` para generar el Worker y probarlo en el runtime local de Cloudflare.
4. Ejecuta `npm run deploy` para publicar en Workers. El nombre inicial del Worker es `cazapisos`, configurable en `wrangler.jsonc`.
5. En Supabase > Authentication > URL Configuration, agrega la URL publicada a **Site URL** y agrega `https://TU-DOMINIO/auth/callback` a **Redirect URLs**. Si utilizas el dominio `workers.dev`, añade también `https://cazapisos.TU-SUBDOMINIO.workers.dev/auth/callback`.

Para despliegues automáticos, conecta el repositorio en Cloudflare Workers Builds y configura:

- **Build command:** `npm run cf-build`
- **Deploy command:** `npx wrangler deploy`

Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` tanto en **Build variables and secrets** como en las variables de runtime del Worker. `SCRAPINGBEE_API_KEY` también debe estar disponible durante el build y en runtime si la usas.

Para publicar manualmente desde tu equipo, inicia sesión con `npx wrangler login` y ejecuta `npm run deploy`.
