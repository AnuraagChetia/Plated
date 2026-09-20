# Plated

Plated is a direct-ordering application for independent restaurants. Owners publish a storefront, manage their menu and orders, upload images, and read diner reviews.

## Implemented flows

- Supabase email/password sign-up, sign-in, session refresh, and protected owner pages.
- Three-step onboarding with draft recovery, restaurant branding, pickup details, and the first menu item.
- Public storefront with categories, search, images, recent reviews, and a cart that survives reloads.
- Pickup or delivery checkout with contact details and notes.
- Server-calculated totals, saved order items, retry-safe submission, and a database limit of five new orders per contact per restaurant within ten minutes.
- Private order tracking, with automatic status updates and a review form after completion.
- Owner dashboard with automatic refresh, new-order notices, order search/filtering, pagination, menu editing with image uploads, review replies, and restaurant settings.
- Editable storefront addresses in restaurant settings; renaming suggests a matching address, with owner-only saves and duplicate-address validation. Previous storefront URLs stop working after an address change.
- Contextual cover and logo editing on the storefront for its authenticated owner, with preview, replace, remove, and save controls.
- Order progression: `NEW → PREPARING → READY → COMPLETED`; active orders can also be cancelled.

Payments, SMS/email notifications, delivery-provider dispatch, and custom-domain services are intentionally outside the current scope. The restaurant handles payment and fulfillment directly.

## Stack

The application uses a shared restaurant-inspired design: charcoal, warm white, burnt-orange accents, and handwritten headings. `app/brand.css` styles the homepage, marketing pages, authentication, onboarding, and order tracking alongside the storefront and owner-dashboard styles. Public pages share `PublicFooter`; homepage previews are labeled examples.

- Next.js 16 App Router, React 19, TypeScript
- Supabase Auth and PostgreSQL with row-level security
- PGlite for isolated PostgreSQL tests
- Plain CSS; no UI framework

## Local setup

Use Node.js 24 and pnpm 11. If reusing `node_modules`, match the pnpm version that originally installed it.

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env.local` and configure:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

3. Apply **unapplied** migrations in numeric order using Supabase SQL Editor:

   | Migration | Adds |
   | --- | --- |
   | [0001](supabase/migrations/0001_plated_schema.sql) | Restaurants, menu items, orders, and initial access policies |
   | [0002](supabase/migrations/0002_reviews_and_media.sql) | Reviews and media metadata |
   | [0003](supabase/migrations/0003_order_integrity.sql) | Order items, database pricing, and atomic restaurant creation |
   | [0004](supabase/migrations/0004_complete_local_features.sql) | Fulfillment, retry keys, tracking, reviews, media content, settings, and summary queries |

   | [0005](supabase/migrations/0005_storefront_underscores.sql) | Underscores in storefront addresses |
   | [0006](supabase/migrations/0006_customer_profiles_and_hours.sql) | Private customer profiles, addresses, order history, and daily restaurant hours |

   These are incremental migrations, not scripts to rerun on an already-updated database. Apply the pending set in a transaction. Existing restaurants and orders are preserved; older orders have no item details or customer-facing receipt links.

4. Configure Supabase Auth's Site URL and allowed redirect URLs. If email confirmation is enabled, confirm your email before signing in.
5. Check the schema and start the app:

   ```bash
   pnpm check:setup
   pnpm dev
   ```

Open [the local app](http://127.0.0.1:3000). Use the same hostname consistently for session cookies. Existing restaurant owners should fill in their pickup address and contact phone in **Settings**.

For a production build:

```bash
pnpm build
pnpm start
```

The application uses the publishable key and user sessions; no service-role key is required. Do not commit credentials or local database files.

## Data and security behavior

- Prices are whole Indian rupees. Checkout submits menu IDs and quantities; the database determines prices.
- `setup_restaurant` creates the restaurant and its first dish in one transaction.
- `checkout_order` serializes duplicate request keys and returns the original receipt for an identical retry. Changed details with the same key are rejected.
- A pending checkout is retained in browser storage and locked against edits until it is confirmed or definitively rejected.
- The order-tracking secret stays in the URL fragment and is sent in a POST body. Anyone holding the private link can view its receipt and submit its one review; keep it private.
- Reviews require a completed order and its tracking token. Owners can change their replies, not diner ratings.
- Image uploads accept PNG, JPEG, or WebP, up to 3 MB each and 30 per restaurant. New files use local disk by default, or a private Supabase Storage bucket with `STORAGE_PROVIDER=supabase`; Supabase stores associations and metadata. Existing database-backed images remain readable and are converted to local storage when replaced.
- Menu images are edited in the dish form. Cover photos and logos are edited on the owner’s storefront. There is no central Media Library. Saving dish details and its image uses two requests; if the image fails, the form retains the saved dish ID so retrying does not create another dish.
- API errors return JSON, and the browser handles empty/HTML responses without exposing JSON parser exceptions.
- `proxy.ts` refreshes sessions for pages. API handlers refresh and validate their own sessions without consuming the incoming request body.

## Routes

| Page | Purpose |
| --- | --- |
| `/`, `/features`, `/how-it-works` | Marketing pages |
| `/sign-up`, `/sign-in` | Owner authentication |
| `/onboarding` | Restaurant creation; sign-in required |
| `/dashboard` | Owner operations; sign-in required |
| `/r/[slug]` | Published restaurant storefront |
| `/order/[id]#token` | Private receipt, status, and review |

| API | Methods | Purpose |
| --- | --- | --- |
| `/api/restaurants` | GET, POST, PATCH | Read, create, and configure the owner's restaurant |
| `/api/dashboard` | GET | Paginated orders/reviews, menu, media, queue, and aggregate metrics |
| `/api/menu` | POST, PATCH | Add/edit dishes, categories, descriptions, and availability |
| `/api/orders` | POST, PATCH | Submit checkout or advance/cancel an order |
| `/api/orders/track` | POST | Read a receipt using its private token |
| `/api/reviews` | POST | Submit a diner review |
| `/api/media?restaurant=…&kind=logo|cover|menu_item&dish=…` | POST, DELETE | Replace/remove an image at its feature location; dish required for menu images |
| `/api/media/[id]` | GET | Read an image subject to restaurant visibility |
| `/api/auth/sign-up`, `/api/auth/sign-in`, `/api/auth/sign-out` | POST | Auth handlers |
| `/api/auth/me` | GET | Current user |

## Repository map

```text
app/
  api/                     JSON API and image handlers
  components/              Shared navigation
  dashboard/               Owner dashboard and editors
  onboarding/              Restaurant setup wizard
  order/[id]/              Private receipt and review form
  r/[slug]/                Storefront and persistent cart
lib/
  api-client.ts            Safe response parsing
  api-server.ts            JSON exception boundaries and setup errors
  browser-storage.ts       Resilient browser storage access
  http.ts                  Bounded request-body parsing
  media.ts                 Image type/size validation
  storage.ts               StorageService and local filesystem implementation
  models.ts                Shared application types
  orders.ts                Checkout validation and status helpers
  supabase/                Browser, server, and route clients
proxy.ts                   Page session refresh/protection
supabase/migrations/       Ordered schema changes
scripts/check-setup.cjs    Read-only database configuration check
tests/                     API regression and database workflow tests
```

Legacy SQLite/JWT code, unused sign-out component, and standalone HTML/CSS/JS prototypes have been removed. Existing local data files are preserved. Active routes use Supabase.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
```

Tests run without live Supabase credentials. They cover the launch request-body regression, empty/non-JSON responses, onboarding response shapes, cart validation, database migrations, duplicate checkout handling, fulfillment/status rules, private tracking, reviews/replies, contact limits, and media access policies.

For database-level verification against an existing Supabase project, run [smoke-test.sql](supabase/smoke-test.sql) in SQL Editor as the database administrator. It requires an account without a restaurant and verifies launch, checkout, retries, private tracking, order statuses, and review replies. All sample records are rolled back. This check passed against the connected project after migrations 0002–0004 were applied.

After configuring the database, verify the full flow: launch a restaurant, edit its menu, upload an image, place an order, track it, advance it to completion, submit a review, and read it in the dashboard. Check both desktop and narrow layouts.

## Troubleshooting

- **Launch returned an empty/non-JSON response:** restart the development server after pulling code changes. The current client shows a recoverable error and retains the draft. The API cookie helper must copy only request headers, not construct a new request from the POST request body.
- **Database update not installed / missing table or function:** run `pnpm check:setup`, apply only pending migrations through 0006, and retry.
- **No pickup option:** add a pickup address and enable pickup in Settings.
- **Order awaiting confirmation after a network failure:** use **Retry and confirm order**. Keep the saved request key so the database can recover the original receipt.
- **pnpm store mismatch:** use the same pnpm major version that installed `node_modules`.

## Operating limits

Dashboard lists use 20 orders or 10 reviews per page, with aggregate metrics across the restaurant. Automatic refresh polls every ten seconds while the page is visible; it does not require a separate real-time service. Media supports images rather than video. The contact quota is a basic abuse limit, not phone verification or a substitute for deployment-level traffic protection. Delivery fees, taxes, payment reconciliation, and third-party dispatch are not calculated by this app.

### Image storage

Keep `UPLOAD_DIR` on a persistent writable volume and back it up alongside the database. Files are served through `/api/media/[id]` after database visibility checks, not from a public uploads directory. For free hosting without persistent disks, use the [Supabase Storage setup](docs/image-storage.md). Local uploads require a persistent application server; deployments with multiple instances must share the same volume. `StorageService` separates validation, upload, read, deletion, and URL generation so an S3 adapter can replace the local implementation later. S3 is not implemented.

### Owner shortcuts

- Click the storefront logo to upload, replace, or remove it (owners only).
- In Dashboard → Menu, use Create category to name a category and save its first dish. Existing categories offer Add dish, and dish editors can move dishes between categories.
- Save confirmations dismiss after four seconds and can also be closed manually.
- The homepage Start for free action checks the session: signed-in users go to the dashboard; other visitors go to onboarding.

Storefront sign-in uses customer-facing copy and preserves restaurant context through registration. Accounts owning a restaurant are routed to their dashboard. Customer profiles save contact details and up to 20 delivery addresses. The latest 100 orders placed while signed in appear in My account. Every checkout opens a tracking-link confirmation modal; guests can reopen their latest link on the same device. Migration `0005_storefront_underscores.sql` allows underscores during restaurant launch.

### Customer checkout and opening hours

- My account lets customers edit their name/phone and add, edit, or remove saved addresses. Checkout prefills saved details, offers address selection, and can save edited delivery details as a new address. Existing orders retain their original contact/address snapshot.
- Signed-in orders are linked to the authenticated user by the database. Earlier guest orders are not automatically attached to accounts. Guest tracking links stay on the current device and can be copied from the confirmation dialog. WhatsApp delivery is not integrated.
- Restaurant settings include optional daily opening/closing times and an IANA timezone (default Asia/Kolkata). Overnight hours work; an unset schedule allows ordering whenever the owner enables Accept new orders. Manual pauses override the schedule. Availability refreshes every 15 seconds and checkout rechecks it atomically in the database.
- Invalid/expired sessions redirect to sign-in. Temporary authentication service/network failures lead to a retry page without exposing protected content. Local logs have shown ECONNRESET failures contacting Supabase; a retry screen cannot eliminate upstream connection failures.

KhaoKa’s six sample dishes have been added as real available menu items at their preview prices. `scripts/seed-khaoka-menu.sql` adds them without duplicating or overwriting existing names. `/r/khaoka` fills empty review-carousel positions with clearly labeled fictional feedback; real reviews take priority. KhaoKa is the dedicated demo restaurant, with no separate preview mode. Category illustrations fill missing menu photos. See [the client walkthrough](docs/khaoka-demo.md) for a presentation checklist.

The storefront shows only the newest six reviews in one horizontal carousel: three cards on desktop, two on tablet, and one on mobile. It advances every five seconds, pauses on hover/focus, offers previous/next and pause controls, and respects reduced-motion preferences.

### Free hosting on Render

The repository includes `render.yaml` for a free Node web service using Supabase image storage. See [deployment instructions](docs/render-deployment.md). Supply credentials only in Render environment settings.

### Branch workflow

- **main**: production; Render deploys this branch.
- **dev**: all future development and testing.
- Release by reviewing and merging dev into main, then deploying main on Render. Pushing dev does not update production.
- Git branches share configured external services. Use a separate Supabase development project before testing database or storage mutations.
