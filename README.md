# BookBack

A marketplace for used school and college books. Sellers list books, an admin approves them, buyers add them to a cart and place an order. Payments, photo uploads and chat are not built yet.

- `backend/`: Express and MongoDB API (see `backend/README.md` and `backend/docs/`)
- `frontend/`: Next.js website

## Run it locally
You need Node.js and a MongoDB Atlas cluster with two databases: one for development and one for tests (its name must end in `_test`).

1. `cd backend`, `npm install`, copy `.env.example` to `.env`, fill in your values, then `npm run dev`
2. `cd frontend`, `npm install`, copy `.env.example` to `.env.local` (set `NEXT_PUBLIC_API_URL`), then `npm run dev`
3. Open `http://localhost:3000`. Use `localhost`, not `127.0.0.1`.

Optional: `npm run seed-demo` in `backend` adds demo books (`-- --remove` deletes them again).

## Staff accounts
Nobody can make themselves an admin through the website. Register the account normally, then run `npm run make-admin -- someone@example.com` in `backend`. Admin screens are under `/admin`.

## Tests
- API tests: `npm test` in `backend`. They use the test database only.
- Browser tests: `npm run e2e` in `frontend`. They start their own copies of the API and the site on ports 5100 and 3100, empty the test database first, and never touch your development data.
- If a test run is interrupted, run `npm run reset-test-db` in `backend` before the next one.
- Security scenarios and where each is tested: `backend/docs/security-test-cases.md`

## Sign in with Google (optional)
Create an OAuth client in Google Cloud and put its public Client ID in `GOOGLE_CLIENT_ID` (backend) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (frontend). No client secret is used.

## What is not built yet
- Payments: every order stays unpaid. A book in an unpaid order stays reserved until the buyer cancels.
- Order fulfilment: nothing moves an order to confirmed, shipped or delivered.
- Photo uploads, chat, exchanges, donations
- Email verification, forgot password, changing your email
- Sellers cannot see why a listing was rejected (the reason is in the audit log)
- A category list and a shipping quote before checkout
- Rate limits are kept in memory, so run a single server process until a shared store is added

## Before going live
Follow `backend/docs/deployment-checklist.md`. Passing tests do not make an app production-ready: real hosting, HTTPS, backups, monitoring and a staging walkthrough still have to be done.