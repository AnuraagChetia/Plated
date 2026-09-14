# Plated

## Recommended production stack

- **Next.js + TypeScript** for the marketing site, restaurant storefronts, SEO, and server-rendered tenant pages.
- **Tailwind CSS + shadcn/ui** for consistent responsive UI.
- **PostgreSQL + Prisma** for restaurant, menu, customer, and order data.
- **Clerk** for restaurant-owner authentication and organization-aware access.
- **Stripe Connect** for payments and settlement to individual restaurants.
- **Vercel** for preview deployments and wildcard subdomains such as `saffron-table.plated.site`.
- **Resend + Trigger.dev** for notifications and reliable background order workflows.

This creates one scalable multi-tenant application: each restaurant gets an SEO-friendly storefront under our domain, and owners use a protected dashboard backed by the same data model.
