-- Support PDF overlay-by-coordinates (templates without AcroForm).
-- fields jsonb shape: [{ "key": "nombre", "page": 0, "x": 200, "y": 400, "size": 18, "align": "left" }, ...]
-- Coords are PDF user-space points: origin bottom-left, 1 pt = 1/72 inch.

alter table templates add column if not exists page_sizes jsonb;
alter table templates add column if not exists has_acroform boolean not null default false;
