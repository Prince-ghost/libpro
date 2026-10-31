# BookBack API

Backend for BookBack, a marketplace for used school and college books. Express and MongoDB (Mongoose), cookie-based sessions, tested with Vitest.

## Requirements
- Node.js (developed and tested on Node 24)
- A MongoDB Atlas cluster, or any replica set. Orders use transactions, which a plain local MongoDB does not support.
- Two databases on that cluster: one for development and one for tests. The test database name must end in `_test`.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` (`copy .env.example .env` on Windows) and fill in your own values. Never share or commit `.env`.
3. `npm run dev`. You should see `Connected to database "..."` and `API listening on http://localhost:5000`.
4. Check it: open `http://localhost:5000/api/health`.

## Environment variables
| Name | Required | Default | Purpose |
|---|---|---|---|
| NODE_ENV | no | development | `development`, `test` or `production` |
| PORT | no | 5000 | Port to listen on |
| CLIENT_ORIGIN | no | http://localhost:3000 | The one frontend origin allowed by CORS. Must be `https://` in production. |
| MONGODB_URI | yes (not in tests) | | Development and production database |
| MONGODB_URI_TEST | yes (in tests) | | Test database. Its name must end in `_test`. |
| SESSION_TTL_DAYS | no | 7 | Login session lifetime |
| AUTH_RATE_LIMIT_MAX | no | 10 | Failed logins (and registrations) per IP per window |
| ORDER_RATE_LIMIT_MAX | no | 20 | Order creations per IP per hour |
| TRUST_PROXY | no | 0 | Number of reverse proxies in front of the app |

## Commands
| Command | What it does |
|---|---|
| `npm run dev` | Start with auto-restart on file changes |
| `npm start` | Start normally |
| `npm test` | Run all tests against the test database |
| `npm run make-admin -- <email> [--revoke]` | Make an existing account an admin, or remove admin rights |
| `npm run indexes` | Create all database indexes (run once on a new or production database) |

## Project layout
```
app.js, server.js        Express app, and the process that starts it
lib/                     env validation, database, auth helpers, errors, rate limiting, CSRF check
models/                  Mongoose models (User, Session, Book, Cart, Wishlist, Address, Order, AuditEvent)
schemas/                 Zod request validation
services/                Business rules
routes/                  HTTP routes: validate, call a service, send the response
scripts/                 make-admin, sync-indexes
tests/integration/       API tests
docs/                    api.md, security-test-cases.md, deployment-checklist.md
```

## API
See `docs/api.md`. Every success response is `{ data, meta }` and every error is `{ error: { code, message, details?, requestId } }`.

## Roles and the first admin
New accounts are always normal users. There is no API for creating admins. Register the account through the app first, then run `npm run make-admin -- you@example.com` on your own computer. It prints the database it used.

## Testing
Tests create fake accounts ending in `@example.test` in the test database and delete them afterwards. They never touch your development data. A full run takes several minutes on a remote cluster, so running one file at a time is often easier:

    npx vitest run tests/integration/orders.test.js

Security scenarios and where each is tested are listed in `docs/security-test-cases.md`.

## Known limitations
- No payments yet: every order stays `unpaid`. A book in an unpaid order stays `reserved` until the buyer cancels (there is no automatic expiry).
- No endpoint moves an order to confirmed, shipped or delivered.
- No image upload yet (`imageKeys` is unused), and no password reset, email verification or email change.
- Rate limits are kept in memory, so they only work correctly with a single server process.
- Listing search uses a case-insensitive text match, which is fine for a small catalogue.
- A rejection reason is stored in the audit log but not shown to the seller.
- The audit log is append-only by convention. Production should also remove edit and delete rights at the database level.
- The session cookie is `SameSite=Lax`, so the frontend and the API must be on the same site (for example `app.example.com` and `api.example.com`).
- Shipping is a flat INR 40 per order, a placeholder.
- There are no browser tests yet, because they need the frontend.