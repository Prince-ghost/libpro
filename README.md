# BookBack

BookBack used school aur college books ke liye marketplace hai. Sellers listings banakar photos upload kar sakte hain, admins listings moderate karte hain, aur buyers books browse karke wishlist, cart aur orders manage kar sakte hain.

## Project structure

- `backend/` - Express, MongoDB aur Mongoose API
- `frontend/` - Next.js website
- `docs/` - API reference, security test cases aur deployment checklist
- `postman/` - API collections, environments aur mocks

```text
libpro/
├── backend/
│   ├── app.js                 # Express application
│   ├── server.js              # API entry point
│   ├── lib/                   # Database, auth, CSRF, validation aur rate limits
│   ├── models/                # Mongoose models
│   ├── routes/                # HTTP route handlers
│   ├── schemas/               # Request validation schemas
│   ├── services/              # Business logic
│   ├── scripts/               # Admin, seed, index aur test database utilities
│   └── tests/integration/     # Vitest API integration tests
├── frontend/
│   ├── app/                   # Next.js routes aur pages
│   ├── components/            # Auth, books, shop, admin aur UI components
│   ├── lib/                   # API client aur frontend helpers
│   └── e2e/                   # Playwright browser tests
├── docs/                      # API, security aur deployment documentation
├── postman/                   # Collections, environments, mocks aur specs
└── README.md
```

## Requirements

- Node.js 24 (development mein isi version par test kiya gaya hai)
- MongoDB Atlas ya koi aur MongoDB replica set. Orders mein transactions use hote hain, isliye standalone local MongoDB server enough nahi hai.
- Same cluster par do databases: ek development ke liye aur ek tests ke liye. Test database ka naam `_test` par end hona chahiye.

## Local setup

### 1. Backend/API setup

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

`.env` mein `MONGODB_URI` aur `MONGODB_URI_TEST` set karo, phir API start karo:

```powershell
npm run dev
```

API default mein `http://localhost:5000` par chalegi. Health check:

`http://localhost:5000/api/health`

### 2. Frontend setup

Ek second terminal mein:

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Website `http://localhost:3000` par open karo. `localhost` use karo, `127.0.0.1` nahi, taaki session cookie aur CORS settings correctly match karein.

### Demo data (optional)

```powershell
cd backend
npm run seed-demo
npm run seed-demo -- --remove
```

Pehli command demo books add karti hai aur doosri command unhe remove karti hai.

## Main features

- Cookie-based authentication with password login aur optional Google sign-in
- Book listings with moderation, search, filters, categories aur seller management
- Image uploads with validation, resizing aur thumbnails
- Cart, wishlist aur saved addresses
- Transaction-based order creation with idempotency support
- Seller shipping updates aur buyer delivery confirmation
- Admin dashboards for listings, users, orders aur audit events
- CSRF protection, security headers, validation aur rate limiting

## Frontend screens

- `/` - home page aur API health status
- `/books` aur `/books/[id]` - catalogue, filters, search aur book details
- `/login` aur `/register` - authentication
- `/sell`, `/my-listings` aur `/my-listings/[id]/edit` - seller listing management
- `/wishlist`, `/cart`, `/checkout` - shopping flow
- `/orders` aur `/orders/[id]` - buyer orders, cancellation aur receipt confirmation
- `/sales` aur `/sales/[id]` - seller orders aur shipping
- `/account` aur `/addresses` - profile aur address management
- `/admin`, `/admin/listings`, `/admin/orders`, `/admin/users` aur `/admin/audit` - admin tools

## Admin account banana

New accounts normal users hote hain. Pehle website se account register karo, phir backend directory se admin banao:

```powershell
npm run make-admin -- someone@example.com
```

Admin screens `/admin` par available hain. Admin access revoke karne ke liye:

```powershell
npm run make-admin -- someone@example.com --revoke
```

## Tests

- Backend integration tests: `cd backend; npm test`
- Frontend lint: `cd frontend; npm run lint`
- Frontend production build: `cd frontend; npm run build`
- Frontend browser tests: `cd frontend; npm run e2e`
- Latest Playwright report open karna: `cd frontend; npm run e2e:report`
- Interrupted test run ke baad test database reset karna: `cd backend; npm run reset-test-db`

Backend mein 14 serial integration suites hain. Inke liye transaction-capable MongoDB test database chahiye jiska naam `_test` par end hota ho.

Browser tests sirf test database reset karte hain, frontend ko port 3100 par build/start karte hain aur API ko port 5100 par start karte hain. Chromium tests serially, ek worker ke saath run hote hain. In tests mein authentication, marketplace browsing, cart, checkout, moderation, photos, fulfilment, admin access, cookies aur XSS-safe rendering cover hote hain. Development data ko touch nahi kiya jata.

Security scenarios aur unki coverage [docs/security-test-cases.md](docs/security-test-cases.md) mein hai.

## Google sign-in (optional)

Google Cloud mein OAuth client banao aur dono `.env` files mein public Client ID set karo:

- Backend: `GOOGLE_CLIENT_ID`
- Frontend: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

`GOOGLE_CLIENT_ID` configure na hone par backend ka Google endpoint unavailable rahega. Application mein client secret use nahi hota.

## Environment variables

Backend configuration `backend/.env` mein hoti hai:

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `test` ya `production` |
| `PORT` | `5000` | API listening port |
| `CLIENT_ORIGIN` | `http://localhost:3000` | Allowed frontend origin; production mein HTTPS hona chahiye |
| `MONGODB_URI` | - | Development ya production database |
| `MONGODB_URI_TEST` | - | Test database; database name `_test` par end hona chahiye |
| `SESSION_TTL_DAYS` | `7` | Session lifetime, 1 se 90 days ke beech |
| `AUTH_RATE_LIMIT_MAX` | `10` | Failed login/registration requests per rate-limit window |
| `ORDER_RATE_LIMIT_MAX` | `20` | Har hour order creation requests |
| `TRUST_PROXY` | `0` | Trusted reverse proxies ki count |

Frontend configuration `frontend/.env.local` mein hoti hai:

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000` | Browser-facing API base URL |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | - | Optional public Google OAuth client ID |

`NEXT_PUBLIC_API_URL` frontend build ke time embed hota hai. Isliye `npm run build` se pehle deployed API ka correct URL set karo. Frontend credentials ke saath API requests bhejta hai, isliye `CLIENT_ORIGIN`, cookies aur frontend/API domains ko saath mein configure karna zaroori hai. Same-site domains use karo, jaise `app.example.com` aur `api.example.com`.

## Current limitations

- Payments integrate nahi hain; new orders `unpaid` start hote hain.
- Unpaid reservations automatically expire nahi hote; buyer ko eligible order cancel karna hota hai.
- `confirmed` order status data model mein hai, lekin abhi use nahi ho raha.
- Chat, exchanges aur donations implemented nahi hain.
- Email verification, password reset aur email change flows implemented nahi hain.
- Sellers apni rejected listings ka rejection reason dekh sakte hain.
- Shipping flat INR 40 placeholder hai; shipping quote step nahi hai.
- Rate limits process memory mein store hote hain. Multiple API instances ke liye shared store chahiye.
- Search case-insensitive regular-expression matching use karta hai, jo small catalogue ke liye suitable hai.
- Image binaries MongoDB mein store hote hain, object storage mein nahi.
- Audit-log immutability application convention se enforce hoti hai; production mein database write/delete permissions bhi restrict karo.

## API aur deployment documentation

- API reference: [docs/api.md](docs/api.md)
- Deployment checklist: [docs/deployment-checklist.md](docs/deployment-checklist.md)
- Backend setup aur commands: [backend/README.md](backend/README.md)

Tests pass hona alone production-ready hone ki guarantee nahi hai. Deployment checklist complete karo, HTTPS, backups aur monitoring configure karo, aur launch se pehle staging walkthrough run karo.
