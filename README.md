# Plated

Plated is a direct-ordering platform for independent restaurants. Owners create branded ordering sites, manage menus and orders, and retain a direct relationship with diners.

## Current application

- Owner-facing marketing site, Features, and How it works pages
- Supabase email/password sign-up and sign-in
- Session-aware navigation and sign-out
- Multi-step restaurant onboarding and dashboard foundation
- Public restaurant storefront route: `/r/[slug]`
- Local cart and order-placement flow
- Supabase SQL migration with Row Level Security policies

## Stack

- Next.js 16 + TypeScript
- Supabase Auth + PostgreSQL
- `@supabase/ssr` for server-side session cookies
- Local SQLite prototype layer, retained only while Supabase data routes are completed

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://127.0.0.1:3000`.

## Supabase setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Set these values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

4. Run [the initial migration](supabase/migrations/0001_plated_schema.sql) in Supabase SQL Editor.

Never commit `.env.local`, database files, or Supabase secret keys. `.gitignore` excludes these.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Plated landing page |
| `/how-it-works` | Product workflow |
| `/features` | Product capabilities |
| `/sign-up` | Owner account creation |
| `/sign-in` | Owner sign-in |
| `/onboarding` | Restaurant setup |
| `/dashboard` | Owner dashboard |
| `/r/[slug]` | Public restaurant storefront |

## Next milestones

1. Complete Supabase-backed restaurants, menus, orders, and dashboard queries.
2. Add media uploads and review workflows.
3. Add payment/payout integration and wildcard storefront domains.
