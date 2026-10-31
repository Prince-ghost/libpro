# Deployment checklist

## Before the first deploy
- [ ] Production uses its own database and its own Atlas user with `readWrite` on that database only. Never reuse development or test credentials.
- [ ] Atlas network access lists only the host's addresses (not "allow from anywhere"), or the risk is written down.
- [ ] Atlas backups are on and a restore has been tried once.
- [ ] `npm ci` builds from the committed lockfile, and `npm audit --omit=dev` has no unexplained findings.

## Environment
- [ ] `NODE_ENV=production`
- [ ] `CLIENT_ORIGIN` is the exact `https://` address of the frontend
- [ ] `MONGODB_URI` is the production database
- [ ] `TRUST_PROXY` matches the number of proxies in front of the app (usually `1`). Check your host's documentation.
- [ ] `PORT` is the value the host provides
- [ ] No secrets in the repository, in screenshots or in logs

## First run
- [ ] Run `npm run indexes` once against the production database. The app does not create indexes in production.
- [ ] Create the first admin from your own computer with `npm run make-admin -- you@example.com`, using the production connection string temporarily, then remove it from your machine.
- [ ] `GET /api/health` returns 200 over HTTPS.

## Cookies and domains
- [ ] The frontend and the API share a parent domain (for example `app.example.com` and `api.example.com`). The cookie is `SameSite=Lax`, and a login will silently fail across unrelated domains.
- [ ] The frontend sends requests with `credentials: "include"`.
- [ ] A login shows `Secure` and `HttpOnly` on the `bookback_sid` cookie.

## Operations
- [ ] Run a single server process, because rate limits are kept in memory. For several processes, add a shared rate-limit store first.
- [ ] Logs are collected and contain no passwords, cookies or connection strings. Error alerts are set up.
- [ ] There is a written rollback step (redeploy the previous version).
- [ ] Payments stay disabled, and the interface says orders are unpaid.

## Staging walkthrough (fake accounts)
- [ ] Register, log in and log out
- [ ] Seller lists a book, admin approves it, a visitor sees it
- [ ] Buyer adds it to the cart, saves an address and places an order
- [ ] A second buyer cannot buy the same book
- [ ] Buyer cancels an order and the book returns to the catalogue
- [ ] A normal user gets 403 on `/api/admin/*`