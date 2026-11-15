# BookBack

BookBack is a full-stack marketplace for giving used school, competitive-exam and college books a second life. A buyer can discover books by subject or course, save favourites, add a book to the cart, buy it now, pay through Razorpay test mode, and follow delivery progress. Sellers manage their own listings and shipments, while administrators moderate catalogue content and oversee marketplace activity.

The project is designed as a practical marketplace foundation rather than a production payment-and-logistics company. It demonstrates authentication, catalogue management, image storage, cart and order workflows, seller fulfilment, exchanges and secure API patterns in one application.

## Project structure

- `backend/` - Express, MongoDB and Mongoose API
- `frontend/` - Next.js website
- `docs/` - API reference, security test cases and deployment checklist
- `postman/` - API collections, environments and mocks

```text
libpro/
├── backend/
│   ├── app.js                 # Express application
│   ├── server.js              # API entry point
│   ├── lib/                   # Database, auth, CSRF, validation and rate limits
│   ├── models/                # Mongoose models
│   ├── routes/                # HTTP route handlers
│   ├── schemas/               # Request validation schemas
│   ├── services/              # Business logic
│   ├── scripts/               # Admin, seed, index and test-database utilities
│   └── tests/integration/     # Vitest API integration tests
├── frontend/
│   ├── app/                   # Next.js routes and pages
│   ├── components/            # Auth, books, shop, admin and UI components
│   ├── lib/                   # API client and frontend helpers
│   └── e2e/                   # Playwright browser tests
├── docs/                      # API, security and deployment documentation
├── postman/                   # Collections, environments, mocks and specs
└── README.md
```

## Requirements

- Node.js 24 (the version used during development)
- MongoDB Atlas, or another MongoDB replica set. Order creation uses transactions, so a standalone local MongoDB server is not enough.
- Two databases on the same cluster: one for development and one for tests. The test database name must end in `_test`.

## Run locally

1. Install backend dependencies and configure the API:

   ```powershell
   cd backend
   npm install
   Copy-Item .env.example .env
   ```

   Set `MONGODB_URI` and `MONGODB_URI_TEST` in `.env`, then start the API:

   ```powershell
   npm run dev
   ```

   The API runs at `http://localhost:5000`. Verify it at `http://localhost:5000/api/health`.

2. In a second terminal, install and start the frontend:

   ```powershell
   cd frontend
   npm install
   Copy-Item .env.example .env.local
   npm run dev
   ```

   Open `http://localhost:3000`. Use `localhost`, not `127.0.0.1`, so the session cookie and CORS settings match.

Optional demo data:

```powershell
cd backend
npm run seed-demo
npm run seed-demo -- --remove
```

The demo seed creates approved listings for Classes 9–12 and a wide range of college courses. It also imports the cover images in `backend/assets/demo-covers/` into MongoDB. Demo listings belong to the non-loginable `demo.seller@example.test` seller; create a listing with a normal account when testing the seller shipping workflow.

## Main features

- Cookie-based authentication with password login and optional Google sign-in
- Password reset through Resend, with a development-only reset-link fallback
- Book listings with moderation, search, filters, categories and seller management
- Image uploads with validation, resizing and thumbnails
- Cart, wishlist, saved addresses and one-click Buy now
- Razorpay checkout integration with test-mode payment signature verification
- Transactional order creation with idempotency support and one-of-a-kind book reservations
- Seller shipping updates and buyer delivery confirmation
- Exchange requests with seller accept/reject controls and manual handoff
- Admin dashboards for listings, users, orders and audit events
- CSRF protection, security headers, validation and rate limiting

## Marketplace flow

1. A seller registers, creates a listing and uploads optional cover photos.
2. An administrator approves the listing before it becomes publicly available.
3. A buyer searches or filters the catalogue, saves a book, adds it to the cart or selects **Buy now**.
4. The buyer selects a delivery address and completes a Razorpay payment. Development and staging should use `rzp_test_...` credentials, so no real money is charged.
5. The book is reserved for that order. The seller opens **Sales**, reviews the delivery address and marks the book as shipped.
6. The buyer confirms receipt, which completes fulfilment for that book.

Each listing belongs to the account that created it. The demo catalogue is owned by the seeded demo seller; real listings are shipped by their real seller account. Razorpay live payments, when deliberately enabled, are collected by the configured BookBack merchant account; seller payouts are not automated yet.

## Frontend screens

- `/` - home page and API health status
- `/books` and `/books/[id]` - catalogue, filters, search and book details
- `/login` and `/register` - authentication
- `/sell`, `/my-listings` and `/my-listings/[id]/edit` - seller listing management
- `/wishlist`, `/cart`, `/checkout` - shopping flow
- `/orders` and `/orders/[id]` - buyer orders, cancellation and receipt confirmation
- `/sales` and `/sales/[id]` - seller orders and shipping
- `/exchanges` - sent and received book exchange requests
- `/forgot-password` and `/reset-password` - password recovery
- `/account` and `/addresses` - profile and address management
- `/admin`, `/admin/listings`, `/admin/orders`, `/admin/users` and `/admin/audit` - admin tools

## Admin account

New accounts are regular users. Register normally, then promote an account from the backend directory:

```powershell
npm run make-admin -- someone@example.com
```

Admin screens are available at `/admin`. To revoke admin access:

```powershell
npm run make-admin -- someone@example.com --revoke
```

## Deploy on Render

Deploy the backend and frontend as two separate Render Web Services. Use custom domains under the same parent domain when possible, such as `api.example.com` and `app.example.com`; this keeps the session cookie compatible with the browser.

### 1. Prepare MongoDB Atlas

1. Create a dedicated production database and database user.
2. Grant the user `readWrite` access only to that database.
3. Configure Atlas Network Access for Render. Render outbound IPs may be dynamic, so allowing `0.0.0.0/0` is convenient but should be restricted or documented according to your Render plan.
4. Copy the production connection string. Do not use `MONGODB_URI_TEST` or the development database.

### 2. Create the backend service

In Render, choose **New → Web Service**, connect the repository, and set:

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm ci` |
| Start Command | `npm start` |

Add these environment variables in Render. Keep secrets in Render only; do not commit them:

```text
NODE_ENV=production
CLIENT_ORIGIN=https://app.example.com
MONGODB_URI=<production MongoDB URI>
TRUST_PROXY=1
RESEND_API_KEY=<Resend production key>
EMAIL_FROM=BookBack <no-reply@your-verified-domain.example>
RAZORPAY_MODE=test
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=<Razorpay test secret>
```

Use the Render-provided `PORT`; do not hard-code a different port. Add `GOOGLE_CLIENT_ID` only when Google sign-in is configured. Keep `RAZORPAY_MODE=test` for fake payments. Change it to `live` only after a real payment launch has been deliberately approved.

After deployment, copy the backend URL and verify:

```text
https://<backend-service>.onrender.com/api/health
```

It must return HTTP 200.

Run production indexes once from a secure local terminal using the production `MONGODB_URI`:

```powershell
cd backend
npm run indexes
npm run make-admin -- your-admin@example.com
```

Remove the production connection string from your local environment after these commands. Never run `npm run seed-demo` against production.

### 3. Create the frontend service

Create another Render Web Service with:

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Runtime | Node |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |

Add this environment variable **before the first build**:

```text
NEXT_PUBLIC_API_URL=https://<backend-service>.onrender.com
```

`NEXT_PUBLIC_API_URL` is baked into the Next.js build. If you later add a custom API domain, update this variable and redeploy the frontend.

### 4. Connect domains and verify

1. Add the final frontend domain to the backend `CLIENT_ORIGIN` exactly, including `https://` and without a trailing slash.
2. Update `NEXT_PUBLIC_API_URL` to the final API URL and redeploy the frontend.
3. Open the site and test registration, login, logout, cart, checkout and seller shipping.
4. With `RAZORPAY_MODE=test`, use only Razorpay test credentials and test payment methods. No real money is charged.
5. Confirm the browser stores `bookback_sid` as `Secure` and `HttpOnly`.

Render's free services may sleep when idle. The first request after inactivity can be slow; this is expected and is not an application error.

## Tests

- Backend integration tests: `cd backend; npm test`
- Frontend lint: `cd frontend; npm run lint`
- Frontend production build: `cd frontend; npm run build`
- Frontend browser tests: `cd frontend; npm run e2e`
- Open the latest Playwright report: `cd frontend; npm run e2e:report`
- Reset the test database after an interrupted run: `cd backend; npm run reset-test-db`

The backend has 14 serial integration suites. They require a transaction-capable MongoDB test database whose name ends in `_test`.

Browser tests reset only that test database, build and start the frontend on port 3100, start the API on port 5100, and run Chromium tests serially with one worker. They cover authentication, marketplace browsing, cart and checkout, moderation, photos, fulfilment, admin access, cookies and XSS-safe rendering. They never touch development data.

Security scenarios and their coverage are documented in [docs/security-test-cases.md](docs/security-test-cases.md).

## Google sign-in (optional)

Create an OAuth client in Google Cloud and set the public Client ID in both `.env` files:

- Backend: `GOOGLE_CLIENT_ID`
- Frontend: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

The backend Google endpoint is unavailable when `GOOGLE_CLIENT_ID` is not configured. No client secret is used by this application.

## Environment notes

Backend configuration is in `backend/.env`:

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `test` or `production` |
| `PORT` | `5000` | API listening port |
| `CLIENT_ORIGIN` | `http://localhost:3000` | Allowed frontend origin; must be HTTPS in production |
| `MONGODB_URI` | - | Development or production database |
| `MONGODB_URI_TEST` | - | Test database; database name must end in `_test` |
| `SESSION_TTL_DAYS` | `7` | Session lifetime, from 1 to 90 days |
| `AUTH_RATE_LIMIT_MAX` | `10` | Failed login/registration requests per rate-limit window |
| `ORDER_RATE_LIMIT_MAX` | `20` | Order creation requests per hour |
| `TRUST_PROXY` | `0` | Number of trusted reverse proxies |
| `RAZORPAY_MODE` | `test` | Razorpay mode; keep `test` for fake payments |
| `RAZORPAY_KEY_ID` | - | Razorpay public key used by the checkout modal |
| `RAZORPAY_KEY_SECRET` | - | Razorpay server secret used to create and verify payments |
| `RESEND_API_KEY` | - | Resend API key for password reset emails |
| `EMAIL_FROM` | - | Verified Resend sender, for example `BookBack <no-reply@example.com>` |
| `DEV_PASSWORD_RESET_LINKS` | `false` | Development-only fallback that displays a reset link when Resend is unavailable |

Frontend configuration is in `frontend/.env.local`:

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000` | Browser-facing API base URL |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | - | Optional public Google OAuth client ID |

`NEXT_PUBLIC_API_URL` is baked into the frontend build and must point to the deployed API before `npm run build`. The frontend sends API requests with credentials, so the API `CLIENT_ORIGIN`, cookie settings and frontend/API domains must be configured together. Use same-site domains such as `app.example.com` and `api.example.com`.

## Current limitations

- Razorpay payments are integrated. Keep `RAZORPAY_MODE=test` and use `rzp_test_...` keys for fake payments; production live payments require `RAZORPAY_MODE=live`.
- Razorpay test keys are required for the checkout modal; without them the API intentionally reports that payments are not configured.
- Unpaid reservations do not expire automatically; the buyer must cancel an eligible order.
- The `confirmed` order status exists in the data model but is not currently used.
- Chat and donations are not implemented. Book exchanges support manual request, accept and reject flows.
- Email verification and email changes are not implemented. Password reset uses Resend when configured.
- Sellers cannot currently see the rejection reason shown in the admin audit log.
- Shipping is a flat INR 40 placeholder and there is no shipping quote step.
- Rate limits are stored in memory, so production should run a single API process or use a shared store.
- Search uses case-insensitive regular-expression matching and is intended for a smaller catalogue.
- Image binaries are stored in MongoDB rather than object storage.
- Audit-log immutability is enforced by application convention; production should also restrict database write and delete permissions.

## API and deployment documentation

- API reference: [docs/api.md](docs/api.md)
- Deployment checklist: [docs/deployment-checklist.md](docs/deployment-checklist.md)
- Backend setup and commands: [backend/README.md](backend/README.md)

Passing tests alone does not make the application production-ready. Complete the deployment checklist, configure HTTPS, backups and monitoring, and run a staging walkthrough before launch.