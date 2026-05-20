-- Store generation params so PDFs can be rebuilt on demand (no storage blobs needed).
alter table historial add column if not exists payload jsonb;
