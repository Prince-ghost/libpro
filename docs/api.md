# BookBack API

Success: `{ "data": ..., "meta": { "requestId": "..." } }`
Error: `{ "error": { "code", "message", "details?", "requestId" } }`

## Auth (cookie session `bookback_sid`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /api/auth/register | public, rate-limited | 201, 400, 409 |
| POST | /api/auth/login | public, rate-limited | 200, 401, 429 |
| POST | /api/auth/logout | any | always 200 |
| GET | /api/auth/me | login | 200, 401 |

## Books
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/books | public | Only approved + active. Query: page (1-1000), limit (1-50, default 12), q (max 100), category, audience, condition, minPrice, maxPrice (paise), sort (newest, price_asc, price_desc). Invalid value: 400. |
| GET | /api/books/mine | login | Own non-archived listings, with moderationState. page, limit. |
| POST | /api/books | login | 201. Body: title, author, category, audience, condition, priceMinor (+ optional classOrCourse, edition, description). Starts pending + active. Other fields ignored. |
| GET | /api/books/:id | public / owner / admin | Public: approved, not archived. Owner/admin: any state, plus moderationState. Others: 404. |
| PATCH | /api/books/:id | owner / admin | Same fields as POST, all optional, at least one. Owner edit resets to pending. 404 for non-owner, 409 BOOK_LOCKED if not active. |
| DELETE | /api/books/:id | owner / admin | Soft archive. Repeat is 200. 409 BOOK_LOCKED if reserved/sold. |

Money is integer paise (`priceMinor`), 1 to 10,000,000. A malformed id is 400; an unknown or hidden one is 404.