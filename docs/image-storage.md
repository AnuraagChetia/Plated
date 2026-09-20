# Persistent images on free hosting

Local development defaults to local disk. Hosted deployments should set STORAGE_PROVIDER=supabase. The existing StorageService routes reads/deletes by stored key, so changing the upload provider does not break old associations on the original server. Menu, cover and logo flows stay unchanged.

## Configure and migrate before deploying

1. Add SUPABASE_SERVICE_ROLE_KEY to the ignored .env.local file using your Supabase project's server-only service role credential. Never put it in a NEXT_PUBLIC_ variable, source control, or browser code.
2. Keep NEXT_PUBLIC_SUPABASE_URL set to the existing project. SUPABASE_STORAGE_BUCKET defaults to restaurant-images; use the same bucket locally and on the host.
3. On the computer containing data/uploads (or UPLOAD_DIR), run the read-only audit:

   node --env-file=.env.local scripts/migrate-image-storage.cjs

4. Apply the migration:

   node --env-file=.env.local scripts/migrate-image-storage.cjs --apply

The apply command creates a private bucket if needed with a 3 MB limit and PNG/JPEG/WebP types. It uploads local and legacy database images, downloads and verifies each copy with SHA-256, then updates the existing media row. IDs and associations are preserved. Concurrent changes are checked before updating. Re-running skips migrated rows after checking that their remote objects exist. Original local files remain intact. On an uncertain error, copies are retained; inspect storage before cleaning orphan objects.

5. Only after a successful migration, set STORAGE_PROVIDER=supabase locally and on your hosting provider. Add the same URL, publishable key, server-only service role key, and bucket name to the host. Restart/redeploy and check existing images plus upload, replace, and remove.

## Access control

Keep the bucket private; no public upload/read policies are required. Only server code accesses the bucket with the privileged credential. Existing media API routes first enforce restaurant ownership for changes and database row visibility for reads. URLs remain /api/media/<id>. Local and remote files can coexist during migration, but local files will not be available on a fresh hosting instance.

No database schema migration is required. Storage paths distinguish local/ from supabase/. Database-backed legacy images stay readable until migrated. This uses Supabase Storage's API, not an AWS S3 account.
