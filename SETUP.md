# Próximos pasos (manuales)

Lista accionable de lo que tenés que hacer vos para que el proyecto arranque y termine en Vercel. Va en orden — no saltes pasos.

---

## 1. Supabase: crear proyecto y schema

1. Entrá a https://supabase.com → **New project**.
   - Anotá la **DB password** (la vas a necesitar si después usás la CLI).
   - Elegí región cercana a Vercel (ej. `us-east-1` o `sa-east-1`).
2. Esperá ~2 min a que termine el provisioning.
3. **Project Settings → API** → copiá:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (esta **nunca** va al cliente)
4. **SQL Editor → New query** → pegá y corré, en orden:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_pdf_overlay.sql`

   Verificá en **Table editor** que existan: `app_users`, `templates`, `certificates`.

## 2. Supabase Storage: crear los buckets

1. **Storage → New bucket** → nombre `templates`.
   - **Public bucket: OFF** (debe quedar privado).
2. Repetir → bucket `certificates`, también privado.

> No hace falta configurar políticas RLS de Storage por ahora: todo el acceso pasa por el service-role key del servidor.

## 3. Variables de entorno locales

```bash
cp .env.example .env.local
```

Editá `.env.local` y completá:

| Var | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL del paso 1.3 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public del paso 1.3 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role del paso 1.3 |
| `AUTH_SECRET` | corré `openssl rand -base64 32` y pegá la salida |

## 4. Probar local

```bash
npm run dev
```

Abrí http://localhost:3000 y verificá:

- [ ] `/register` → crear una cuenta de prueba.
- [ ] `/login` → iniciar sesión, redirige a `/dashboard`.
- [ ] `/templates` → subir un PDF cualquiera (sin AcroForm está bien).
- [ ] `/templates/<id>/edit` → clickear sobre el PDF para colocar campos (`nombre`, `curso`, `fecha`), **Save fields**.
- [ ] Generar un certificado:
  ```bash
  curl -X POST http://localhost:3000/api/certificates/generate \
    -H 'content-type: application/json' \
    -b 'authjs.session-token=...' \
    -d '{"templateId":"<UUID>","values":{"nombre":"Juan Perez","curso":"Excel","fecha":"2026-05-06"}}'
  ```
  (más fácil: armar la página `/certificates` con un form — está stub a propósito).
- [ ] En Supabase → Storage → `certificates/` debería aparecer el archivo nuevo.

## 5. Repositorio remoto

Si todavía no hay remote:

```bash
gh repo create admincentic --private --source=. --remote=origin --push
```

O manual:

```bash
git add -A
git commit -m "feat: initial scaffold (Next 16 + NextAuth + Supabase + cert overlay)"
gh repo create admincentic --private
git remote add origin git@github.com:<tu-usuario>/admincentic.git
git push -u origin main
```

## 6. Deploy a Vercel

1. https://vercel.com/new → **Import Git Repository** → elegí el repo.
2. Framework: **Next.js** (auto-detect). Build & install: dejar default.
3. **Environment Variables** → agregar las 4 del paso 3 (sin `_local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AUTH_SECRET`
4. **Deploy**.
5. Una vez deployado, abrí `https://<tu-app>.vercel.app/register` y repetí el smoke test del paso 4.

> No agregues `export const runtime = "edge"` a las rutas de cert. `pdf-lib` y `docxtemplater` necesitan Node runtime.

## 7. Lo que falta construir (decisión tuya, en orden de impacto)

- [ ] **Página `/certificates` real**: listar templates del usuario, elegir uno, renderizar un input por cada `key` de `template.fields`, POST a `/api/certificates/generate`, mostrar link de descarga.
- [ ] **Listado de templates** en `/templates`: hoy solo tiene el form de upload. Agregar tabla con link a `…/edit` y botón "Usar para generar".
- [ ] **Descarga de certificado emitido**: ruta `GET /api/certificates/[id]/download` que devuelva un signed URL del bucket `certificates`.
- [ ] **Drag-to-move** en el editor: hoy es solo click-to-add + remove. Útil para ajustar fino.
- [ ] **Bulk**: subir CSV → emitir N certificados de un solo template.
- [ ] **Validación de keys**: cuando se generan, avisar si en `values` falta algún `key` definido en `template.fields`.

## 8. Riesgos / cosas a tener en cuenta

- **service_role key**: si alguna vez la pegás en código del cliente, exponés la base entera. Vive solo en `lib/supabase/admin.ts`, importado solo desde route handlers o server components.
- **PDFs grandes**: el render en `react-pdf` carga el archivo en el browser. PDFs >10 MB pueden lagear. Si pasa, agregar paginado lazy o hacer thumbnail server-side.
- **Fuentes**: el overlay usa Helvetica estándar. Si necesitás tildes/ñ con tipografía custom, embebé un TTF en `fillPdfByPlacements` (extender `PdfFieldDef` con `fontUrl`).
- **Backups**: Supabase free tier hace backup diario solo los últimos 7 días. Si el negocio depende de los certificados, contratá un plan con PITR o exportá a S3 periódicamente.
- **Auth simple**: NextAuth Credentials no manda emails de verificación ni resetea passwords. Si lo necesitás, considerá migrar a Supabase Auth (sección "Switch to Supabase Auth" en `CLAUDE.md`).
