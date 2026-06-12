-- Storage bucket for app uploads (STORAGE_PROVIDER=supabase).
-- Id must match SUPABASE_STORAGE_BUCKET (Terraform default: hootnshoot-media).
-- public = true so getPublicUrl() URLs work in the browser without signed URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('hootnshoot-media', 'hootnshoot-media', true)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  name = EXCLUDED.name;
