# Run Plated with Docker

Install Docker with the Linux container engine running and Docker Compose v2. The image uses Node.js 22, pnpm 10.2.1, and Next.js standalone output, running as a non-root user. Supabase remains the external database and authentication service.

## Start locally

1. Copy `.env.example` to `.env.local` if needed and configure Supabase. Apply any pending database migrations as described in the README. Use a separate Supabase project for development that changes data.
2. Run from the repository root:

   ```bash
   docker compose --env-file .env.local up --build -d
   docker compose logs -f app
   ```

3. Open http://localhost:3001. Configure the matching Supabase Auth Site URL and allowed redirects. Use the same hostname consistently for session cookies.

To stop without deleting uploads:

```bash
docker compose down
```

Set `APP_PORT` and `SITE_URL` in the environment file to change the port and canonical origin together. The default port avoids conflicting with a local development server on port 3000.

## Images and secrets

- `STORAGE_PROVIDER=supabase` uses your existing private bucket and requires `SUPABASE_SERVICE_ROLE_KEY` at runtime. See [image storage](image-storage.md).
- `STORAGE_PROVIDER=local` writes to the named `uploads` volume at `/app/data/uploads`. Compose overrides any Windows `UPLOAD_DIR` value. Back up this volume alongside the database; `docker compose down --volumes` deletes it.
- Existing host filesystem uploads are not copied into the image or the initially empty volume. Migrate them to Supabase using the storage guide, or copy them into the volume with ownership writable by UID 1000 before switching over. Existing Supabase-backed images stay accessible with the same project and bucket configuration.
- Environment files and local uploads are excluded from the build context. Only the two public Supabase values are build arguments; the service-role key is injected at runtime. Never put it into a Docker build argument or a `NEXT_PUBLIC_` variable.
- Next.js embeds public environment values during the build. Rebuild after changing either public Supabase value; runtime overrides alone do not update browser bundles.

## Hosting the image

The container listens on `0.0.0.0:3000`. Publish that port through your host's HTTPS reverse proxy and set `SITE_URL` to the public HTTPS origin. The supplied Compose port binds to loopback for local use; adapt the binding for your host's routing setup. Keep secrets in the hosting platform's runtime environment settings. Use Supabase storage or a persistent upload volume; multiple replicas need shared storage.

This setup does not change the existing Render Node deployment or automatically run database migrations. Docker changes are developed on `dev`; production remains on `main` until a release is requested.
