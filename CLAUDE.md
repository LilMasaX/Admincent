# Nominapp — Claude project guide

Aplicación web para **gestión de nómina** y **generación de certificados/desprendibles** en Centic SAS.

Combina dos productos previos (la app Electron `Nominapp` y el scaffold web `admincentic`) en un **único Next.js + Supabase desplegable en Vercel**. Electron quedó descartado: todo corre en web.

## Stack

- **Next.js 16 (App Router) + React 19 + TypeScript** — `src/` layout, alias `@/*`.
- **Tailwind v4** — `src/app/globals.css`, tema oscuro con acento `#f44336`.
- **NextAuth (Auth.js) v5 beta** — Credentials provider, JWT sessions.
- **Supabase** — Postgres + Storage. Server-side calls usan service-role key.
- **pdf-lib** — Genera el PDF del desprendible y rellena plantillas (overlay/AcroForm).
- **docxtemplater + pizzip** — Render de plantillas DOCX `{{placeholder}}`.
- **Resend** — Envío de correos con adjuntos.
- **bcryptjs**, **zod** — Hash de password y validación.
- **react-hot-toast**, **lucide-react**, **react-number-format** — UI.
- **Deploy**: Vercel (todas las rutas en runtime Node — no Edge).

## Modelo de datos (single workspace)

Todos los usuarios autenticados comparten la misma base de nómina (no hay `owner_id` en las tablas de nómina). `templates`/`certificates` sí están scopeadas por usuario.

Tablas (ver `supabase/migrations/`):

- `app_users` — credenciales (email + bcrypt hash) usadas por NextAuth.
- `templates`, `certificates` — plantillas y certificados generados por usuario.
- `trabajadores`, `instructores`, `proveedores` — colaboradores.
- `devengados`, `deducciones` — fijos por trabajador (FK a `trabajadores`).
- `historial` — log de desprendibles generados/enviados.
- `nomina_counters` (+ función `next_comprobante()`) — contador atómico para el número de comprobante.

Storage buckets (privados): `templates`, `certificates`, `desprendibles`.

## Folder map

```
src/
  app/
    layout.tsx                  Layout raíz (tema oscuro Nominapp).
    page.tsx                    Landing → redirige a /dashboard si hay sesión.
    (auth)/login/page.tsx
    (auth)/register/page.tsx
    (dashboard)/
      layout.tsx                Sidebar + Toaster, gating por proxy.ts.
      dashboard/page.tsx        Home con stats y atajos.
      desprendibles/page.tsx    Generador y envío de desprendibles.
      colaboradores/
        empleados/page.tsx
        instructores/page.tsx
        proveedores/page.tsx
      historial/page.tsx
      templates/page.tsx + [id]/edit
      certificates/page.tsx
    api/
      auth/[...nextauth]/route.ts
      register/route.ts
      templates/...             (cert: subir/listar/editar campos)
      certificates/generate/route.ts
      nomina/
        trabajadores/route.ts + [id]/route.ts
        instructores/route.ts + [id]/route.ts
        proveedores/route.ts + [id]/route.ts
        devengados/route.ts + [id]/route.ts
        deducciones/route.ts + [id]/route.ts
        historial/route.ts
        desprendible/route.ts   POST → genera PDF, sube a storage, inserta historial.
        email/route.ts          POST → envía con Resend, actualiza historial.
  components/
    layout/Sidebar.tsx          Sidebar Nominapp con grupos colapsables.
    providers.tsx
    ui/Modal.tsx
    colaboradores/              PersonaPage<T>, PersonaForm, PersonaTable, ConceptosModal.
    TemplateEditor.tsx          Editor de campos sobre PDF (react-pdf).
  lib/
    auth/config.ts
    supabase/{admin,server,browser}.ts
    cert/{pdf,docx,index}.ts    Render de certificados (existing).
    nomina/
      auth.ts                   requireSession() helper para route handlers.
      payment.ts                calculatePayment + formatCOP.
      desprendible-pdf.ts       buildDesprendiblePdf — genera el PDF con pdf-lib.
      comprobante.ts            nextComprobanteNumber() vía RPC.
      email.ts                  sendDesprendibleEmail (Resend).
  proxy.ts                      Auth gate: protege /dashboard, /desprendibles, /colaboradores, /historial, /templates, /certificates.
  types/next-auth.d.ts
supabase/migrations/
  0001_init.sql                 app_users, templates, certificates.
  0002_pdf_overlay.sql          page_sizes / has_acroform.
  0003_nominapp.sql             Nómina (trabajadores, …, historial, counters).
public/logo.webp
```

## Flujos principales

### 1. Auth
1. `/register` → `POST /api/register` → bcrypt hash → insert `app_users`.
2. `/login` → `signIn("credentials")` → `lib/auth/config.ts:authorize` lee `app_users`.
3. JWT callback guarda `uid`. Session expone `session.user.id`.
4. `src/proxy.ts` redirige a `/login` cualquier ruta protegida sin sesión.

### 2. Desprendible
1. UI (`/desprendibles`) recolecta tipo persona, persona, fechas, devengados, deducciones, anotaciones, archivo opcional.
2. Para empleados, también carga devengados/deducciones fijas desde `/api/nomina/devengados|deducciones?trabajadorId=`.
3. **Generar PDF**: `POST /api/nomina/desprendible`
   - Llama `next_comprobante()` para obtener número correlativo.
   - `buildDesprendiblePdf` crea el PDF (pdf-lib, layout landscape Letter con header rojo, dos columnas, totales, valor a pagar).
   - Sube a `desprendibles/<tipo>/<comprobante>_<nombre>_<uuid>.pdf` y registra `historial` (estado `Generado`).
   - Devuelve `{ pdfBase64, historialId, comprobante, storagePath }`.
4. **Enviar correo**: el cliente luego llama `POST /api/nomina/email` con el PDF base64, adjunto opcional, HTML del correo y `historialId`. Resend envía y actualiza `historial` (`Enviado` o `Fallido`).

### 3. Certificados (templates → certificates)
1. **Plantilla**: `/templates` → `POST /api/templates` (multipart). Detecta PDF/DOCX, extrae page sizes, flag AcroForm.
2. **Editor PDF**: `/templates/[id]/edit` → click-to-place. `PATCH /api/templates` guarda `fields[]`.
3. **Generación**: `POST /api/certificates/generate { templateId, values }`. Si hay placements, overlay con pdf-lib; si hay AcroForm, fallback a fill form; DOCX usa docxtemplater. Resultado va a bucket `certificates` y queda registro en tabla `certificates`.

## Variables de entorno

`.env.example`:

| Var | Notas |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pública |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `RESEND_API_KEY` | Server only |
| `RESEND_FROM` | Email remitente verificado en Resend |

## Setup Supabase (resumen)

1. Crear proyecto, anotar URL + keys.
2. SQL editor → correr en orden `0001_init.sql`, `0002_pdf_overlay.sql`, `0003_nominapp.sql`.
3. Storage → crear buckets **privados**: `templates`, `certificates`, `desprendibles`.
4. Verificar que aparezca la fila `('comprobante', 0)` en `nomina_counters` y la función `next_comprobante`.

## Scripts

```
npm run dev     # next dev
npm run build   # next build
npm run start   # next start
npm run lint    # eslint
```

## Convenciones

- **Service-role solo en servidor**: `lib/supabase/admin.ts` — nunca importar desde código `'use client'`.
- **Auth helper**: en route handlers, usar `requireSession()` de `lib/nomina/auth.ts` (devuelve `{ session, response }`).
- **Tema**: variables CSS (`--color-background`, `--color-surface`, `--color-accent`) definidas en `globals.css`. UI 100% Tailwind.
- **Moneda**: `formatCOP(value)` (es-CO COP, sin decimales).
- **Pdf-lib**: layout en puntos PDF (origen inferior-izquierdo, 1pt = 1/72in). Letter landscape = 792×612.
- **Vercel**: no agregar `export const runtime = "edge"` en rutas de nómina/cert. Necesitan Node.

## Extensibilidad

- **Multi-tenant nómina**: agregar `owner_id` a tablas de nómina + filtrado en cada query (hoy es single workspace).
- **Más metadata por trabajador** (EPS, fondo de pensión, ARL): extender schema y `PersonaForm` field config.
- **Numeración por año**: `next_comprobante` actualmente es global; cambiar a `(year, value)` con UPSERT si se requiere reinicio anual.
- **Bulk**: endpoint que reciba CSV y dispare N desprendibles secuenciales.
- **Switch a Supabase Auth**: reemplazar Credentials, mover `app_users` a `auth.users` + `profiles`, activar RLS por `auth.uid()`.
