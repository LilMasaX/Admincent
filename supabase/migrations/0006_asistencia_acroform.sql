-- Asistencia: support AcroForm PDF templates with named text fields.
-- acroform_fields: detected raw field names (string array) at upload time.
-- acroform_field_map: user-defined mapping from PDF field name → logical FieldKey.
--   Shape: [{ "pdfField": "nombre_part", "key": "nombre", "monthFormat": "numeric" }]
alter table templates add column if not exists acroform_fields jsonb;
alter table templates add column if not exists acroform_field_map jsonb;
