# BookBack

BookBack is a marketplace for used school and college books. Sellers create listings and upload photos, admins moderate listings, and buyers can browse, save, add books to a cart, place orders, and track fulfilment.

## Project structure

- `backend/` - Express, MongoDB and Mongoose API
- `frontend/` - Next.js website
- `docs/` - API reference, security test cases and deployment checklist
- `postman/` - API collections, environments and mocks

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

## Main features

- Cookie-based authentication with password login and optional Google sign-in
- Book listings with moderation, search, filters, categories and seller management
- Image uploads with validation, resizing and thumbnails
- Cart, wishlist and saved addresses
- Transactional order creation with idempotency support
- Seller shipping updates and buyer delivery confirmation
- Admin dashboards for listings, users, orders and audit events
- CSRF protection, security headers, validation and rate limiting

## Frontend screens

- `/` - home page and API health status
- `/books` and `/books/[id]` - catalogue, filters, search and book details
- `/login` and `/register` - authentication
- `/sell`, `/my-listings` and `/my-listings/[id]/edit` - seller listing management
- `/wishlist`, `/cart`, `/checkout` - shopping flow
- `/orders` and `/orders/[id]` - buyer orders, cancellation and receipt confirmation
- `/sales` and `/sales/[id]` - seller orders and shipping
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

Frontend configuration is in `frontend/.env.local`:

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000` | Browser-facing API base URL |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | - | Optional public Google OAuth client ID |

`NEXT_PUBLIC_API_URL` is baked into the frontend build and must point to the deployed API before `npm run build`. The frontend sends API requests with credentials, so the API `CLIENT_ORIGIN`, cookie settings and frontend/API domains must be configured together. Use same-site domains such as `app.example.com` and `api.example.com`.

## Current limitations

- Payments are not integrated; new orders start as `unpaid`.
- Unpaid reservations do not expire automatically; the buyer must cancel an eligible order.
- The `confirmed` order status exists in the data model but is not currently used.
- Chat, exchanges and donations are not implemented.
- Email verification, password reset and email changes are not implemented.
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