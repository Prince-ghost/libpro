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

## Cart (login required; the user always comes from the session)
| Method | Path | Notes |
|---|---|---|
| GET | /api/cart | `{ items, count, subtotalMinor, currency }`. Items that can no longer be bought are dropped; their ids are in `meta.removed`. Prices are informational. |
| POST | /api/cart/items | Body `{ bookId }` only. Quantity is always 1. 200 (repeat is safe), 400, 404 hidden/unknown, 409 `OWN_LISTING` / `BOOK_UNAVAILABLE` / `CART_FULL` (max 50). |
| DELETE | /api/cart/items/:bookId | 200 even if the book was not in the cart. |

## Wishlist (login required)
| Method | Path | Notes |
|---|---|---|
| GET | /api/wishlist | `{ items, count }`, newest first. Sold books show their status; hidden or archived ones are left out. |
| POST | /api/wishlist/:bookId | 200 (repeat is safe), 400, 404 hidden/unknown, 409 `WISHLIST_FULL` (max 200). |
| DELETE | /api/wishlist/:bookId | 200 even if the book was not saved. |

## Addresses (login required; every query is scoped to the session user)
| Method | Path | Notes |
|---|---|---|
| GET | /api/addresses | Own addresses, default first. |
| POST | /api/addresses | 201. recipientName, phone, line1, city, state, postalCode (+ optional line2, country, isDefault). First address is the default. Max 10 (409 `ADDRESS_LIMIT`). Indian PIN: 6 digits. |
| PATCH | /api/addresses/:id | Same fields, all optional, at least one. `isDefault` may only be `true`. 404 for someone else's address. |
| DELETE | /api/addresses/:id | 200 `{ id, deleted }`; default is passed on. 404 if not yours or already deleted. |

## Orders (login required)
| Method | Path | Notes |
|---|---|---|
| POST | /api/orders | Body `{ addressId }` only. Optional header `Idempotency-Key` (8-64 of A-Z a-z 0-9 - _). Reads the buyer's own cart, reprices from the database, reserves books atomically. 201 new order, 200 repeat of an earlier request with the same key, 400 `EMPTY_CART`, 404 address, 409 `ITEMS_UNAVAILABLE` (details list bookIds), 429. All or nothing. |
| GET | /api/orders | Own orders, newest first. page, limit (max 50). |
| GET | /api/orders/:id | Buyer only (404 otherwise). |

New orders are `status: placed`, `paymentStatus: unpaid`. Payment is not implemented. Ordered books become `reserved`.

## Order extras (login required)
| Method | Path | Notes |
|---|---|---|
| POST | /api/orders/:id/cancel | Buyer only, while `placed` and `unpaid`. Releases the reserved books, adds a timeline event. 200 (repeat is safe), 404 not yours/unknown, 409 `ORDER_NOT_CANCELLABLE`. |

Order responses also include `timeline: [{ status, at }]` and `cancellable`.

## Seller view (login required, read-only)
| Method | Path | Notes |
|---|---|---|
| GET | /api/seller/orders | Orders that include your books. Only your items, your subtotal and `shipTo` (name and address, no phone). No buyer identity or order total. page, limit (max 50). |
| GET | /api/seller/orders/:id | 404 if you are not a seller on that order. `shipTo` is null once the order is cancelled. |

## Profile (login required)
| Method | Path | Notes |
|---|---|---|
| GET | /api/profile | `{ id, name, email, role, createdAt }`. |
| PATCH | /api/profile | Body `{ name }` only (2 to 80 characters). Email and role cannot be changed here. |
| POST | /api/profile/password | Body `{ currentPassword, newPassword }`. 400 `INVALID_PASSWORD` if the current one is wrong. Ends all other sessions, keeps this one. Rate-limited. |

## Admin (login required AND role admin: 401 if not logged in, 403 if not an admin)
The role is read from the database on every request. There is no API to create or remove admins.

| Method | Path | Notes |
|---|---|---|
| GET | /api/admin/books | Moderation queue, oldest first. Filters: moderationState, status. page, limit (max 50). Shows seller id and name, no email. |
| PATCH | /api/admin/books/:id | Body `{ moderationState: "approved" \| "rejected", reason? }`. `reason` (3-500 chars) is required when rejecting. Only this field changes. Repeating a decision is 200 and not audited twice. 409 `CONFLICT` if the listing was edited in the meantime. |
| GET | /api/admin/orders | Read-only. Buyer name and id, items, amounts. No address, phone or email. Filters: status, paymentStatus. |
| GET | /api/admin/users | Filters: role, status, email (exact). Never returns password data. |
| PATCH | /api/admin/users/:id | Body `{ status: "active" \| "disabled" }`. Disabling ends the user's sessions. 409 `CANNOT_MODIFY_SELF`, 409 `ADMIN_PROTECTED`. |
| GET | /api/admin/audit | Append-only log, newest first: `{ action, source, actorId, targetType, targetId, details, createdAt }`. |

## Creating and removing admins (local command, not an API)
In `backend/`, with your `.env` in place and the person already registered:

    npm run make-admin -- someone@example.com
    npm run make-admin -- someone@example.com --revoke

It prints the database it used. It refuses to remove the last admin. Both actions are written to the audit log with `source: "cli"`.

| POST | /api/auth/google | public, rate-limited | Body `{ credential }` (Google ID token) only. Verified server-side (signature, audience, expiry, verified email). Creates the account or signs in, sets the same cookie as login. If the email matches a password account, the account is linked, the old password stops working and old sessions end. 400, 401 `INVALID_GOOGLE_TOKEN` / `SIGNIN_FAILED`, 503 `GOOGLE_NOT_CONFIGURED`. |

## Photos (login required to upload)
| Method | Path | Notes |
|---|---|---|
| POST | /api/images | Multipart form with one file in the field `file` (JPEG, PNG or WebP, up to 5 MB, at least 100 px). Re-encoded to WebP (max 1200 px) with a 400 px thumbnail, metadata removed. 201 `{ id, width, height }`. 400 `INVALID_IMAGE`, 415 `UNSUPPORTED_IMAGE_TYPE`, 413 `FILE_TOO_LARGE`, 409 `TOO_MANY_PENDING_IMAGES` (max 20 unused), 429. Unused uploads delete themselves after 24 hours. |
| GET | /api/images/:id?size=full\|thumb | Visible to everyone if the listing is approved, otherwise only to the uploader and admins. Others get 404. |
| DELETE | /api/images/:id | Uploader only, and only for a photo not on a listing. 409 `IMAGE_IN_USE` otherwise. |

Listings: `imageKeys` (up to 5 photo ids, cover first) can be sent on `POST /api/books` and `PATCH /api/books/:id`. Sending the list replaces it; leaving it out changes nothing. Photos must belong to the seller. Dropped photos are deleted, and archiving a listing deletes its photos. Listing responses include `images`, the photo ids in order.


## Fulfilment (login required)
| Method | Path | Notes |
|---|---|---|
| POST | /api/seller/orders/:id/ship | A seller on the order marks all of THEIR books in it as shipped. 200 (repeat is safe), 404 if you are not a seller on it, 409 `ORDER_CANCELLED`. |
| POST | /api/orders/:id/items/:bookId/received | The buyer confirms one book arrived. The book becomes sold, and when every book is received the order becomes delivered. 200 (repeat is safe), 404 (not your order or not in it), 409 `NOT_SHIPPED` / `ORDER_CANCELLED`. |

Each order item has `fulfilment` (`pending`, `shipped` or `delivered`), `shippedAt` and `deliveredAt`. The seller order view adds `canShip`. An order is `placed` until a book ships, `shipped` until every book is received, then `delivered`. A buyer can cancel only while nothing has shipped.

## Rejection reasons
When an admin rejects a listing, the reason is saved as `moderationNote` and shown (only) to the seller and admins, while the listing stays rejected. It is cleared when the listing is approved or the seller edits it. It is also kept in the audit log.