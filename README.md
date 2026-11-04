# CazaPiso ðŸ 

**CazaPiso** es un tablero personal para organizar anuncios de alquiler. Permite guardar enlaces, revisar los datos extraÃ­dos, clasificar propiedades por estado y registrar notas de seguimiento.

---

## ðŸ› ï¸ Stack TecnolÃ³gico

- **Frontend & Backend**: Next.js 16 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS (Mobile-First, diseÃ±o minimalista inspirado en Notion y Linear)
- **Iconos**: Lucide React
- **Base de datos & Auth**: Supabase (PostgreSQL con Row Level Security + Supabase Auth con SSR)
- **Web Scraping & ExtracciÃ³n**: Cheerio con protecciÃ³n contra SSRF y lÃ­mites de payload
- **Despliegue recomendado**: Vercel

---

## ðŸš€ Puesta en marcha local

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

Opcionalmente, para que el extractor intente obtener pÃ¡ginas que bloquean el acceso directo, crea una cuenta en [ScrapingBee](https://www.scrapingbee.com/) y aÃ±ade su API key a `.env.local`:

```env
SCRAPINGBEE_API_KEY=tu-api-key-de-scrapingbee
```

La aplicaciÃ³n primero intenta acceder directamente al anuncio. Si falla o detecta una pÃ¡gina de bloqueo, usa ScrapingBee con renderizado JavaScript. Este servicio puede consumir crÃ©ditos y no garantiza que todos los portales permitan la extracciÃ³n. La clave se usa solo en el servidor y no debe llevar el prefijo `NEXT_PUBLIC_`.

Si el portal todavÃ­a bloquea el contenido y tu plan de ScrapingBee lo permite, puedes activar `SCRAPINGBEE_PREMIUM_PROXY=true` en `.env.local`. Con renderizado JavaScript, la documentaciÃ³n del proveedor indica un costo de 25 crÃ©ditos por solicitud; dÃ©jalo desactivado si no quieres ese consumo.

### 3. Configurar la base de datos en Supabase

1. Crea un proyecto en [Supabase](https://supabase.com).
2. Entra en el panel de tu proyecto y dirÃ­gete al menÃº **SQL Editor**.
3. Abre el archivo `supabase/schema.sql` de este proyecto, copia todo su contenido y ejecÃºtalo con **Run**.
4. Este script configurarÃ¡:
   - Tabla `boards` (tableros de bÃºsqueda).
   - Tabla `properties` (anuncios inmobiliarios guardados).
   - Tabla `property_notes` (notas independientes con fecha para cada anuncio).
   - Enum `property_status` (`guardado`, `contactado`, `visita`, `descartado`).
   - Ãndices de rendimiento por `user_id`, `board_id` y `status`.
   - **Row Level Security (RLS)** estricto: ningÃºn usuario puede ver, crear, editar o borrar tableros ni propiedades que no le pertenezcan.
   - Trigger automÃ¡tico para la columna `updated_at`.

Si ya tienes CazaPiso instalado en Supabase, ejecuta tambiÃ©n `supabase/migrations/20261026_property_features.sql` para agregar el campo opcional de caracterÃ­sticas. La migraciÃ³n conserva todas las propiedades existentes. Para guardar varias notas con fecha por anuncio, ejecuta tambien `supabase/migrations/20261026_property_notes.sql`; traslada las notas existentes con una fecha aproximada.

El tablero ofrece vistas de lista y Kanban sobre las mismas propiedades de Supabase, con arrastre entre columnas y selector mÃ³vil de estado. El botÃ³n de tema estÃ¡ en la barra superior y alterna directamente entre modo claro y oscuro; si no hay una preferencia guardada, sigue el tema del sistema. Al abrir una propiedad se muestra un detalle editable; tambiÃ©n se puede abrir en una pestaÃ±a propia en `/properties/[id]`, protegido por la autenticaciÃ³n y las polÃ­ticas RLS de Supabase.

La extracciÃ³n rellena las caracterÃ­sticas que el portal exponga mediante JSON-LD, microdatos, tablas o listas de datos. Los valores no detectados quedan vacÃ­os y se pueden completar desde el formulario de captura o el detalle de la propiedad.

### 4. Iniciar el servidor de desarrollo

```bash
npm run dev
```

Abre tu navegador en [http://localhost:3000](http://localhost:3000).

### ExtensiÃ³n local para guardar desde el navegador

1. Abre `chrome://extensions` (Chrome) o `edge://extensions` (Edge) y activa **Modo de desarrollador**.
2. Pulsa **Cargar descomprimida** y selecciona la carpeta `extensions/cazapisos-local`.
3. En las opciones del popup, configura la URL y la clave pÃºblica anon de Supabase desde `.env.local` o el panel de Supabase. No uses una clave `service_role`.
4. Inicia sesiÃ³n una vez con la misma cuenta que usas en CazaPiso.
5. Abre un anuncio, pulsa el icono de la extensiÃ³n, elige **Detectar datos del anuncio**, revisa los datos y pulsa **Guardar este anuncio**.

El anuncio se guarda directamente en Supabase y el popup muestra la confirmaciÃ³n; no abre ni cambia ninguna pestaÃ±a al guardar. **Editar en CazaPiso** abre el tablero solo cuando lo pulsas. La extensiÃ³n solo analiza la pestaÃ±a activa cuando eliges **Detectar datos del anuncio**. TambiÃ©n detecta y guarda las caracterÃ­sticas visibles del anuncio; puedes revisarlas en el bloque desplegable del popup antes de guardar. Si el anuncio no estÃ¡ cargado en el navegador (por ejemplo, muestra un CAPTCHA), puedes completar los campos manualmente.

---

## ðŸ“± Flujo de Usuario y Funcionalidades

1. **Magic Input (ExtracciÃ³n y Registro)**:
   - Pega el enlace de un anuncio en el input principal.
   - La API (`/api/extract`) consulta la URL priorizando metadatos Open Graph (`og:title`, `og:image`, `og:description`), JSON-LD estructurado (`Product`, `RealEstateListing`) y selectores convencionales de precio en euros.
   - Incluye protecciÃ³n completa contra SSRF (bloqueo de IPs privadas, subredes locales y protocolos no HTTP/HTTPS), lÃ­mites de tiempo (timeout de 10s) y lÃ­mite de descarga (5MB).
   - Si un portal bloquea la peticiÃ³n (p. ej. Cloudflare o antibot), la aplicaciÃ³n permite continuar introduciendo o editando los datos manualmente sin bloquear al usuario.
   - El usuario previsualiza y confirma siempre antes de guardar.
2. **Dashboard de bÃºsqueda**:
   - Tablero predeterminado creado automÃ¡ticamente ("Mi bÃºsqueda").
   - Tarjetas visuales con fotografÃ­a, tÃ­tulo, precio formateado en euros, enlace directo al anuncio original y menÃº de opciones.
   - Filtros por estado con contador en tiempo real (`Todos`, `Guardado`, `Contactado`, `Visita`, `Descartado`).
3. **GestiÃ³n de Estados y Notas**:
   - Cambio de estado instantÃ¡neo con persistencia directa en Supabase.
   - Panel de notas desplegable por propiedad para apuntar observaciones de llamadas o visitas.
   - ConfirmaciÃ³n modal antes de eliminar propiedades.
4. **AutenticaciÃ³n segura**:
   - Registro e inicio de sesiÃ³n con Supabase Auth vÃ­a email y contraseÃ±a.
   - Middleware de Next.js para refresco de sesiones y protecciÃ³n de rutas.
   - Si las credenciales no estÃ¡n configuradas, se muestra una guÃ­a visual interactiva sin romper la navegaciÃ³n.

---

## ðŸ”’ Decisiones ArquitectÃ³nicas y de Seguridad

1. **Row Level Security en Cascada**:
   - Las propiedades no confÃ­an en ningÃºn `user_id` enviado desde el cliente; verifican la propiedad del usuario a travÃ©s de una clÃ¡usula `EXISTS` sobre el `board_id` y `auth.uid()`.
2. **ProtecciÃ³n contra SSRF en `/api/extract`**:
   - Se validan protocolos estrictamente `http` y `https`.
   - Se bloquea la resoluciÃ³n a `localhost`, `127.0.0.1`, `::1`, IPs privadas (10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x) y dominios `.local` / `.internal`.
3. **ImÃ¡genes Externas**:
   - Dado que los anuncios provienen de infinidad de dominios de portales (Idealista, Fotocasa, inmobiliarias locales), se emplean etiquetas `<img>` con fallback a icono si la imagen falla o caduca, evitando que la aplicaciÃ³n rompa por restricciones de dominios en Next/Image.
4. **DegradaciÃ³n Elegante (Graceful Degradation)**:
   - El backend de extracciÃ³n es tolerante a fallos: devuelve `success: false` con mensaje descriptivo y la interfaz permite completar los campos manualmente con un solo toque.

---

## Despliegue en Cloudflare Workers

La aplicaciÃ³n necesita funciones de servidor (Supabase SSR y `/api/extract`), asÃ­ que se despliega como Worker con OpenNext. Requiere Node.js 20. Para desarrollar localmente, `npm run dev` sigue usando Next.js.

1. Crea una cuenta en Cloudflare e inicia sesiÃ³n en el proyecto con `npx wrangler login`.
2. Configura las variables para el build y el Worker. En Cloudflare Workers > Settings > Variables and Secrets aÃ±ade `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. AÃ±ade `SCRAPINGBEE_API_KEY` solo si usas ese servicio. Para un build local, ponlas en `.env.local` (ignorado por Git).
3. Ejecuta `npm run preview` para generar el Worker y probarlo en el runtime local de Cloudflare.
4. Ejecuta `npm run deploy` para publicar en Workers. El nombre inicial del Worker es `cazapisos`, configurable en `wrangler.jsonc`.
5. En Supabase > Authentication > URL Configuration, agrega la URL publicada a **Site URL** y agrega `https://TU-DOMINIO/auth/callback` a **Redirect URLs**. Si utilizas el dominio `workers.dev`, aÃ±ade tambiÃ©n `https://cazapisos.TU-SUBDOMINIO.workers.dev/auth/callback`.

Para despliegues automÃ¡ticos, conecta el repositorio en Cloudflare Workers Builds y configura las mismas variables y secretos en los ajustes de build del proyecto. Usa `npm run deploy` como comando para generar y publicar el Worker.

