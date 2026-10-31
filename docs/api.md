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