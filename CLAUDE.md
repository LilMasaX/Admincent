# admincentic — Claude project guide

Web app to **automate certificate creation** from base PDF/DOCX templates the user uploads. User fills variable values; backend renders a personalized certificate file and stores it.

## Stack

- **Next.js 16 (App Router) + React 19 + TypeScript** — `src/` layout, alias `@/*`.
- **Tailwind v4** — `src/app/globals.css`, `@tailwindcss/postcss`.
- **NextAuth (Auth.js) v5 beta** — Credentials provider, JWT sessions.
- **Supabase** — Postgres + Storage. Server-side calls use service-role key.
- **pdf-lib** — PDF form fill + text overlay.
- **docxtemplater + pizzip** — DOCX `{{placeholder}}` rendering.
- **bcryptjs** — password hashing.
- **zod** — input validation.
- **Deploy**: Vercel.

## Folder map

```
src/
  app/
    layout.tsx                  Root layout, wraps Providers (SessionProvider).
    page.tsx                    Marketing landing.
    (auth)/login/page.tsx       Sign-in form (client, signIn credentials).
    (auth)/register/page.tsx    Register form (POST /api/register).
    (dashboard)/dashboard/page.tsx     Authed home, signOut.
    (dashboard)/templates/page.tsx     Upload UI for PDF/DOCX templates.
    (dashboard)/certificates/page.tsx  Generation hint page.
    api/auth/[...nextauth]/route.ts    NextAuth handlers.
    api/register/route.ts              Create app_users row.
    api/templates/route.ts             GET list / POST upload (multipart) / PATCH { id, fields[] } save placements.
    api/templates/[id]/route.ts        GET single template (with fields, page_sizes).
    api/templates/[id]/url/route.ts    GET signed URL (10 min) for the stored template file.
    api/certificates/generate/route.ts POST { templateId, values } -> rendered file.
    (dashboard)/templates/[id]/edit/page.tsx  Server page that renders TemplateEditor.
  components/
    providers.tsx               Client SessionProvider wrapper.
    ui/                         Reusable presentational components (empty, add as needed).
    forms/                      Form components (empty, add as needed).
  lib/
    auth/config.ts              NextAuth() instance: { handlers, auth, signIn, signOut }.
    supabase/server.ts          Supabase SSR client (cookie-bound).
    supabase/browser.ts         Supabase browser client.
    supabase/admin.ts           Service-role client. SERVER ONLY.
    cert/pdf.ts                 fillPdfByPlacements (overlay by coords), fillPdfForm (AcroForm fallback), pdfHasAcroForm, getPdfPageSizes.
    cert/docx.ts                fillDocx (docxtemplater).
    cert/index.ts               Re-exports + detectKind(filename) + PdfFieldDefStored type.
  components/
    TemplateEditor.tsx          Client editor: react-pdf preview + click-to-place fields. Saves via PATCH /api/templates.
  proxy.ts                      Auth gate (Next 16 proxy convention). Redirects unauthed users on /dashboard|/templates|/certificates to /login.
  types/next-auth.d.ts          Augments Session.user with `id`.
supabase/migrations/0001_init.sql  Schema for app_users, templates, certificates.
templates/                     Local sample bases (gitignore real client files).
scripts/                       Ad-hoc admin scripts (empty).
```

## Auth flow

1. `/register` → `POST /api/register` → bcrypt hash → insert `app_users`.
2. `/login` → `signIn("credentials", { email, password })` → `lib/auth/config.ts:authorize` looks up `app_users`, compares hash, returns `{ id, email, name }`.
3. JWT callback stores `uid`. Session callback exposes `session.user.id`.
4. `src/proxy.ts` protects `/dashboard`, `/templates`, `/certificates`.

The server route handlers call `auth()` to read the session and `getSupabaseAdmin()` for DB/Storage.

## Certificate generation flow

1. **Upload template** — `POST /api/templates` (multipart: `name`, `file`).
   - `detectKind()` checks `.pdf` / `.docx`.
   - File goes to Supabase Storage bucket `templates/<userId>/<uuid>-<name>`.
   - For PDF: server reads page sizes (`getPdfPageSizes`) and stores them in `templates.page_sizes`; also flags `has_acroform`.
   - DB row in `templates` with `kind`, `storage_path`, `fields = []` (filled later in step 2).
2. **Position fields (PDF only, non-AcroForm path)** — open `/templates/<id>/edit`.
   - The editor renders the PDF with `react-pdf` and lets the user click to drop a placement per `key`.
   - Saved via `PATCH /api/templates` body `{ id, fields }`.
   - `fields` shape: `[{ key, page, x, y, size, align }]`. Coordinates are PDF user-space points (origin **bottom-left**).
3. **Generate** — `POST /api/certificates/generate` body `{ templateId, values }`.
   - Validates ownership.
   - Downloads template bytes from Storage.
   - `pdf` →
     - if `templates.fields` is non-empty → `fillPdfByPlacements` draws each `values[key]` at its stored (x, y, size, align).
     - else if `has_acroform` → `fillPdfForm` (AcroForm fallback for Adobe-prepared PDFs).
     - else → 400 ("PDF template has no field placements").
   - `docx` → `fillDocx` (docxtemplater renders `{{key}}`).
   - Uploads result to `certificates/<userId>/<uuid>.<ext>`.
   - Inserts `certificates` row with input `values` for audit.

### Template authoring rules

- **PDF (no AcroForm — the common case)**: upload the PDF as-is; then use the editor at `/templates/<id>/edit` to click each spot and assign a `key`. The same `key` is what you send in `values` when generating.
- **PDF (with AcroForm — Adobe-prepared)**: detected automatically. If you skip placement editing, the generator falls back to filling AcroForm fields by name.
- **DOCX (recommended for variable-heavy docs)**: use `{{key}}` tags inside the document. No editor needed. Loops/conditions follow docxtemplater syntax.

### Coordinates cheat sheet (PDF)

- pdf-lib origin: **bottom-left**, units = points (1 pt = 1/72 inch). A US Letter page is 612×792.
- The editor converts CSS pixel clicks to points using `page_sizes` and the rendered preview width.
- `align: "center"` and `"right"` shift `x` by the measured text width at draw time so the anchor point matches the click.

## Environment variables

See `.env.example`. Required at runtime:

| Var | Where used | Notes |
|-----|------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Never ship to browser. Used by `lib/supabase/admin.ts` |
| `AUTH_SECRET` | server | `openssl rand -base64 32`. Required by Auth.js v5 |

Local: copy `.env.example` to `.env.local`. Vercel: set in Project Settings → Environment Variables.

## Supabase setup

1. Create a project at https://supabase.com.
2. Apply schema: paste `supabase/migrations/0001_init.sql` then `0002_pdf_overlay.sql` into the SQL editor (or use `supabase db push` with the CLI).
3. Create two **private** Storage buckets: `templates` and `certificates`.
4. Copy URL + anon key + service-role key into `.env.local`.

RLS is intentionally **off** on these tables because all access goes through the server using the service-role key. If you later add direct browser access via the anon key, enable RLS and write per-table policies keyed on `owner_id = auth.uid()` — and migrate auth to Supabase Auth so `auth.uid()` is populated.

## Scripts

```
npm run dev     # next dev
npm run build   # next build
npm run start   # next start (after build)
npm run lint    # eslint
```

## Deploy on Vercel

1. Push repo to GitHub.
2. Import into Vercel; framework auto-detected as Next.js.
3. Set env vars (all four above).
4. Deploy. The middleware and route handlers run on the Vercel Node runtime by default — `pdf-lib` and `docxtemplater` need Node, not Edge. Don't add `export const runtime = "edge"` to the cert routes.

## Conventions

- Server-only modules: anything under `lib/supabase/admin.ts` and `lib/auth/config.ts`. Don't import from client components.
- Path alias `@/*` → `src/*`.
- Route segments under `(auth)` and `(dashboard)` are layout groups — they don't appear in URLs.
- Keep the service-role key server-side. Browser must use the anon key only.

## Extension hooks (where to plug new features)

- **Per-template generation form**: read `templates.fields[].key` and render one input per key, then POST to `/api/certificates/generate`. Currently the certificates page is a stub.
- **Drag-to-reposition** in the editor: `TemplateEditor.tsx` keeps fields in state — wrap each marker in pointer events and update its `x/y` on drag.
- **Snap-to-grid / alignment guides** in the editor: easy add since coords already round-trip through state.
- **Font choice / color** per field: extend `PdfFieldDef` with `font` and `color`, embed via `pdf.embedFont` / `pdf.embedStandardFont` in `fillPdfByPlacements`.
- **DOCX placeholder discovery**: parse with docxtemplater's `getFullText()` + a regex for `{{...}}` tags on upload, store keys in `templates.fields`.
- **Bulk CSV → many certs**: add `/api/certificates/bulk` that loops rows.
- **Switch to Supabase Auth**: replace `lib/auth/config.ts` Credentials with Supabase Auth; turn on RLS; `app_users` becomes `auth.users` + a `profiles` table.
