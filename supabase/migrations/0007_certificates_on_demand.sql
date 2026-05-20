-- Certificates are now regenerated on-demand from template + values.
-- The stored file in storage is no longer required, so storage_path becomes optional.
alter table certificates
  alter column storage_path drop not null;
