-- Asistencia certificate module: type discriminator + optional fixed logo placement.
alter table templates
  add column if not exists tipo text not null default 'certificado'
    check (tipo in ('certificado', 'asistencia'));

-- Fixed extra-logo rectangle: { page, x, y, width, height } in PDF points.
alter table templates
  add column if not exists logo_position jsonb;

create index if not exists templates_tipo_idx on templates(tipo);
