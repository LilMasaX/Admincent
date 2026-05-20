# Nominapp

Web app de nómina (desprendibles, colaboradores, historial) y generación de certificados desde plantillas PDF/DOCX. Stack: **Next.js 16 + React 19 + TypeScript + Tailwind v4 + Supabase + Vercel**.

## Quick start

```bash
cp .env.example .env.local   # rellenar variables (ver SETUP.md)
npm install
npm run dev
```

Abrí http://localhost:3000 → registrate → empieza por `/colaboradores/empleados` y `/desprendibles`.

## Setup

- Schema/buckets/Resend/env vars: ver [SETUP.md](./SETUP.md).
- Arquitectura/convenciones: ver [CLAUDE.md](./CLAUDE.md).

## Scripts

```bash
npm run dev     # dev server
npm run build   # producción
npm run start   # serve build
npm run lint    # eslint
```

## Deploy

Vercel: importar el repo, configurar env vars de `.env.example`. Las rutas API corren en runtime Node (no Edge) por `pdf-lib`, `docxtemplater` y `resend`.
