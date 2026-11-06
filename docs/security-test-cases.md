# Security test cases

Run `npm test`. Each row names the file and what the test checks.

## The spec's scenarios
| Scenario | Automated coverage |
|---|---|
| A. IDOR and ownership | books: another user cannot edit or archive a listing. addresses: cannot edit or delete another user's address. orders: another user cannot read an order, and foreign and unknown ids give the same 404. order-dashboard: cannot cancel another user's order, non-sellers cannot see a seller order. cart-wishlist: carts and wishlists are isolated. admin: 401 and 403 on every admin route. |
| B. Privilege escalation | auth: role and status in the registration body are ignored. books: sellerId, status, moderationState, currency are ignored on create and edit. orders: status, paymentStatus and buyerId are ignored. profile: only the name changes. admin: extra fields and role changes are ignored, and admins cannot be changed through the API. |
| C. Checkout tampering | orders: totals and prices sent by the client are ignored, the price is re-read at checkout, and another user's address is refused. cart-wishlist: quantity and price are ignored. |
| D. One-copy concurrency | orders: four buyers race for one book and exactly one wins. Also covered: five simultaneous cart adds, five identical requests with one idempotency key, three simultaneous cancels, three simultaneous approvals. |
| E. Input abuse and error leakage | books: bad pagination, unsupported sort, over-long search, malformed ids, oversized and malformed bodies. auth: malformed JSON. hardening: oversized body, JSON 404s, and a forced server error that leaks no details. |
| F. Rate limiting and sessions | auth: logout invalidates the session on the server, and the limiter answers 429 past its limit. hardening: no per-account lockout, fresh token per login. profile and admin: password change and disabling a user end sessions. **Manual:** see below, for the real login route. |
| G. XSS-safe rendering | books: markup-like text is stored and returned as plain text (the API side). The rendering side must be verified in the frontend. |

## Other controls
| Control | Coverage |
|---|---|
| Injection | db: operator filters are neutralised. books: regex and operator text in search. auth: operator objects in login. Many routes: operator objects in bodies return 400. |
| Passwords and sessions | auth: Argon2id hash stored, hash never returned, HttpOnly and SameSite cookie, only a hash of the token stored. |
| CSRF | auth: a foreign Origin on a state-changing request gets 403. |
| Headers and CORS | hardening: security headers present, X-Powered-By absent, CORS only for the frontend origin. |

## Manual checks (local only, fake accounts)
1. **Rate limit on the real login route.** With the server running (`npm run dev`):

       '{"email":"nobody@example.test","password":"wrong-password-1"}' | Set-Content -Encoding ascii bad.json
       1..12 | % { curl.exe -s -o NUL -w "%{http_code} " -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" --data-binary "@bad.json" }

   Expect ten `401` and then `429`. Restart the server afterwards to reset the counter.
2. **Production safety checks.**

       $env:NODE_ENV="production"; npm start

   Expect `Invalid environment variables: CLIENT_ORIGIN`. Then add `$env:CLIENT_ORIGIN="https://app.example.com"` and start again. Log in with curl and check that `Set-Cookie` contains `Secure`. Afterwards run `Remove-Item Env:NODE_ENV, Env:CLIENT_ORIGIN`.
3. **Dependencies.** `npm audit --omit=dev` and `npm outdated`. Fix real, exploitable findings and record the rest here. Do not use `npm audit fix --force`.

## Not covered yet
Browser rendering of user-supplied text, end-to-end browser journeys, load testing beyond the rate limits, and any payment or upload code (not built).
## Dependency review ([today's date])
- `npm audit --omit=dev`: 1 high finding in body-parser 2.0.0 to 2.3.0 (denial of service via trailing bytes after a compressed request body, GHSA-27r3-jxmh-p828). Fixed with `npm audit fix` (no `--force`), which only updated a transitive dependency within its allowed range.
- `npm outdated`: dotenv, express-rate-limit and mongoose each had a newer patch version. Updated with `npm update`.
- After updating: `npm audit --omit=dev` reported [result] and `npm test` reported [Test Files / Tests].

## Browser tests (frontend/e2e, run with `npm run e2e` in frontend)
| Scenario or control | Test |
|---|---|
| A. Access control | security.spec.js: a normal user gets 401 when logged out and 403 when logged in on `/api/admin/*`, and the admin page shows no access. marketplace.spec.js: the seller sees no buyer phone or email, and the delivery address disappears after cancelling. |
| D. One copy, one buyer | marketplace.spec.js: a second buyer sees the book as reserved and a hand-made add-to-cart request gets 409. |
| C. Server-side totals | marketplace.spec.js: the order total (book plus shipping) comes from the server. |
| F. Sessions and login | auth.spec.js: the session cookie is HttpOnly and SameSite, nothing is in local or session storage, a wrong password and an unknown email give the same message, logout sticks after a refresh, and a disabled account is logged out and refused. |
| Open redirects | auth.spec.js: `?next=https://evil.example` stays on the site. |
| G. XSS | security.spec.js: markup in a name, a title and a description is shown as plain text, nothing runs, and no image tag is created, on the account, my listings, detail and edit pages. |

## Photo uploads (backend/tests/integration/images.test.js, frontend/e2e/photos.spec.js)
| Control | Test |
|---|---|
| Content check, not trust | SVG, text renamed to .jpg, GIF, tiny images and a pixel bomb are refused. Only JPEG, PNG and WebP are re-encoded and stored. |
| Size limits | More than 5 MB gets 413. Photos are shrunk to 1200 px. |
| Hidden data | Copyright and location metadata do not survive re-encoding. |
| Ownership | Someone else's photo, a photo already on another listing and an unknown id are all refused, and nothing is changed. |
| Access | Pending and unattached photos give 404 to everyone except the owner and admins (backend and browser tests). |
| Safe serving | Photos are served only as WebP we created, with `nosniff`. |
| Abuse limits | 20 unused uploads per person, 60 uploads an hour per address. |
| Orphan cleanup | Unused uploads expire after 24 hours (expiry index tested). Removed and archived listings delete their photos. |