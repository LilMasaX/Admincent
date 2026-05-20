-- Nominapp schema (single workspace; all authenticated users share the same dataset).
-- Migrated from the original SQLite db.db.

create table if not exists trabajadores (
  id bigint generated always as identity primary key,
  nombre text not null,
  cargo text not null,
  email text not null unique,
  documento text not null,
  telefono text not null,
  numero_cuenta text,
  tipo_cuenta text check (tipo_cuenta in ('ahorros', 'corriente')),
  banco text,
  salario numeric(14, 2) not null,
  created_at timestamptz not null default now()
);

create table if not exists instructores (
  id bigint generated always as identity primary key,
  nombre text not null,
  email text not null unique,
  documento text not null,
  telefono text not null,
  numero_cuenta text,
  tipo_cuenta text check (tipo_cuenta in ('ahorros', 'corriente')),
  banco text,
  created_at timestamptz not null default now()
);

create table if not exists proveedores (
  id bigint generated always as identity primary key,
  nombre text not null,
  email text not null unique,
  nit text not null,
  telefono text not null,
  numero_cuenta text,
  tipo_cuenta text check (tipo_cuenta in ('ahorros', 'corriente')),
  banco text,
  created_at timestamptz not null default now()
);

create table if not exists deducciones (
  id bigint generated always as identity primary key,
  trabajadores_id bigint not null references trabajadores(id) on delete cascade,
  concepto text not null,
  valor numeric(14, 2) not null
);
create index if not exists deducciones_trabajador_idx on deducciones(trabajadores_id);

create table if not exists devengados (
  id bigint generated always as identity primary key,
  trabajadores_id bigint not null references trabajadores(id) on delete cascade,
  concepto text not null,
  valor numeric(14, 2) not null
);
create index if not exists devengados_trabajador_idx on devengados(trabajadores_id);

create table if not exists historial (
  id bigint generated always as identity primary key,
  -- qué tipo de documento se generó
  tipo_documento text not null check (tipo_documento in ('desprendible', 'certificado')),
  -- contexto para desprendibles
  persona_id bigint,
  tipo_persona text check (tipo_persona in ('trabajadores', 'instructores', 'proveedores')),
  nombre_persona text,
  persona_eliminada boolean not null default false,
  comprobante bigint,
  -- contexto para certificados
  template_id uuid references templates(id) on delete set null,
  -- campos comunes
  usuario_id uuid references app_users(id) on delete set null,
  nombre_documento text,
  storage_path text,
  email_destino text,
  estado text not null default 'Generado' check (estado in ('Generado', 'Enviado', 'Fallido')),
  fecha_generacion timestamptz not null default now(),
  fecha_envio timestamptz
);
create index if not exists historial_fecha_idx on historial(fecha_generacion desc);
create index if not exists historial_tipo_idx on historial(tipo_documento);
create index if not exists historial_usuario_idx on historial(usuario_id);

-- Atomic counter for "número de comprobante" (formerly comprobante.json).
create table if not exists nomina_counters (
  key text primary key,
  value bigint not null default 0
);
insert into nomina_counters (key, value) values ('comprobante', 0)
on conflict (key) do nothing;

-- Atomic increment helper.
create or replace function next_comprobante() returns bigint
language plpgsql as $$
declare
  next_val bigint;
begin
  update nomina_counters
    set value = value + 1
    where key = 'comprobante'
    returning value into next_val;
  return next_val;
end;
$$;

-- Storage bucket for generated desprendibles (run once in Supabase dashboard or via CLI):
-- insert into storage.buckets (id, name, public) values ('desprendibles', 'desprendibles', false);

-- RLS stays off because the server uses the service-role key (same convention as templates/certificates).
