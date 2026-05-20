# Nominapp — pasos manuales de setup

Lista accionable para arrancar Nominapp local y desplegar en Vercel.

---

## 1. Supabase: proyecto, schema y buckets

1. https://supabase.com → **New project**. Anotá la **DB password**.
2. **Project Settings → API** → copiá:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (nunca al cliente)
3. **SQL Editor → New query** → ejecutá en orden:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_pdf_overlay.sql`
   - `supabase/migrations/0003_nominapp.sql`

   Verificá en **Table editor**: `app_users`, `templates`, `certificates`, `trabajadores`, `instructores`, `proveedores`, `devengados`, `deducciones`, `historial`, `nomina_counters`.

4. **Storage → New bucket** (privados):
   - `templates`
   - `certificates`
   - `desprendibles`

> RLS off: todo el acceso pasa por el service-role del server.

## 2. Resend (correo)

1. https://resend.com → crear cuenta.
2. **API keys** → generar una → `RESEND_API_KEY`.
3. **Domains** → agregar y verificar el dominio que usarás en `RESEND_FROM` (ej. `desprendibles@centicsas.com.co`).

## 3. Variables de entorno locales

```bash
cp .env.example .env.local
```

Completá:

| Var | Valor |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL del paso 1.2 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `RESEND_API_KEY` | Paso 2.2 |
| `RESEND_FROM` | Email remitente verificado |

## 4. Probar local

```bash
npm install
npm run dev
```

Abrí http://localhost:3000:

- [ ] `/register` → crear cuenta.
- [ ] `/login` → entra y redirige a `/dashboard`.
- [ ] `/colaboradores/empleados` → agregar un empleado de prueba con email válido.
- [ ] `/desprendibles` → seleccionar tipo + persona + fechas, agregar un devengado, **Generar PDF** descarga el archivo.
- [ ] `/desprendibles` → **Enviar por correo** envía a la persona seleccionada (revisá Resend logs).
- [ ] `/historial` → aparecen los registros con estado `Generado` o `Enviado`.
- [ ] (opcional) `/templates` → subir PDF/DOCX y editar campos.

## 5. Repositorio remoto

```bash
git add -A
git commit -m "feat: merge nominapp + admincentic into supabase/vercel web app"
gh repo create nominapp --private --source=. --remote=origin --push
```

## 6. Deploy a Vercel

1. https://vercel.com/new → **Import Git Repository**.
2. Framework: Next.js (auto). Build/install default.
3. **Environment Variables** → agregar las 6 del paso 3.
4. Deploy.
5. Smoke test en `https://<tu-app>.vercel.app`.

> **No** agregar `export const runtime = "edge"` en rutas de nómina/cert. `pdf-lib`, `docxtemplater` y `resend` requieren Node runtime.

## 7. Cosas a tener en cuenta

- **service_role key**: solo en `lib/supabase/admin.ts`, nunca en código `'use client'`.
- **PDF**: el desprendible se genera en runtime Node (`buildDesprendiblePdf`). En Vercel free serverless, una invocación dura <2s para casos típicos. Si crecen los devengados/deducciones a >20 filas, revisar la altura del PDF.
- **Resend free tier**: 3.000 emails/mes, 1 dominio. Para producción seria, pasar a plan pagado.
- **Backups Supabase free**: solo 7 días. Si el historial es crítico, exportar periódicamente.
- **Auth Credentials**: no manda verificación ni reset. Para producción, considerar migrar a Supabase Auth.
