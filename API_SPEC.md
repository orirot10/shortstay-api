# Shortstay API Spec

This document summarizes the HTTP routes, request/response examples, status codes, and error formats for the Shortstay API implemented in `src/routes/`.

—

## Authentication 🔐
- All protected endpoints require: `Authorization: Bearer <idToken>` (Firebase ID token).
- When missing or invalid: 401 Unauthorized.

> Error responses follow: `{ "error": "human readable message" }` and validation errors return 400 Bad Request.

---

## Common status codes
- 200 OK — successful GET/PUT/DELETE
- 201 Created — successful creation (POST)
- 400 Bad Request — invalid params / invalid id / validation failed
- 401 Unauthorized — missing/invalid auth
- 404 Not Found — resource not found
- 409 Conflict — conflicts (e.g., already exists)
- 500 Internal Server Error — unexpected error

---

## Users (me) ✅
### GET /me
- Auth: Required
- Description: Bootstraps (upserts) the user profile from Firebase into `users` collection if missing and returns the user summary.

Request headers example:
```
Authorization: Bearer <idToken>
```

Response (200):
```json
{
  "user": {
    "id": "firebase-uid",
    "email": "user@example.com",
    "name": "User Name",
    "avatarUrl": "https://...",
    "hostStats": { "hostScore": 0, "avgRating": 0, "recsCount": 0 },
    "createdAt": "2023-01-20T12:34:56.789Z"
  }
}
```

Errors:
- 401 Unauthorized — missing/invalid token
- 500 Internal Server Error

---

## Listings 🏠
Routes implemented in `src/routes/listings.ts`.

### GET /listings
- Auth: Not required
- Query params: `area` (string), `status` (ACTIVE/INACTIVE), `priceMax` (number)
- Returns list of listings (max 50)

Response (200):
```json
{
  "items": [
    {
      "id": "652be9fa...",
      "ownerId": "firebase-uid",
      "title": "Cozy city apartment",
      "area": "Downtown",
      "pricePerNight": 75,
      "description": "A nice place...",
      "availabilityText": "Available weekends",
      "status": "ACTIVE",
      "images": [{ "storagePath": "uploads/.." }],
      "createdAt": "2024-03-01T10:00:00.000Z",
      "updatedAt": "2024-03-01T10:00:00.000Z"
    }
  ]
}
```

Errors:
- 400 Bad Request — invalid query values

### GET /listings/:id
- Auth: Not required
- Path param: `id` (Mongo ObjectId)
- Response (200):
```json
{
  "item": { /* single listing as above */ }
}
```

Errors:
- 400 Bad Request — invalid id format
- 404 Not Found — missing listing

### POST /listings
- Auth: Required
- Body: see `CreateListingSchema` validations

Request body example:
```json
{
  "title": "Cozy city apartment",
  "area": "Downtown",
  "pricePerNight": 75,
  "description": "A comfortable, central apartment",
  "availabilityText": "Available weekends",
  "images": [{ "storagePath": "uploads/img1.jpg" }]
}
```

Response (201):
```json
{ "id": "652be9fa..." }
```

Errors:
- 400 Bad Request — validation failed
- 401 Unauthorized — missing/invalid token

---

## Requests (rental requests) 📢
Routes implemented in `src/routes/requests.ts`.

### GET /requests
- Auth: Not required
- Query: `area` (optional)
- Returns active requests (max 100)

Response (200):
```json
{
  "items": [
    {
      "id": "652c0abc...",
      "authorId": "firebase-uid",
      "area": "Suburb",
      "dateFrom": "2024-04-01T00:00:00.000Z",
      "dateTo": null,
      "budgetMax": 120,
      "text": "Looking for a place for April",
      "status": "ACTIVE",
      "createdAt": "2024-02-10T12:00:00.000Z",
      "updatedAt": "2024-02-10T12:00:00.000Z"
    }
  ]
}
```

### GET /requests/mine
- Auth: Required
- Returns requests authored by the authenticated user.

### POST /requests
- Auth: Required
- Body example:
```json
{
  "area": "Suburb",
  "dateFrom": "2024-04-01T00:00:00.000Z",
  "dateTo": "2024-04-10T00:00:00.000Z",
  "budgetMax": 120,
  "text": "Looking for a place for early April"
}
```
- Response (201):
```json
{ "id": "652c0abc..." }
```

Errors:
- 400 Bad Request — validation failed
- 401 Unauthorized — missing/invalid token

---

## Hosts & Recommendations ⭐
Routes implemented in `src/routes/hosts.ts`.

### GET /hosts/:hostId
- Auth: Not required
- Returns host profile summary (works even if host is not yet in `users` collection)

Response (200):
```json
{ "host": { "id": "host-uid", "name": null, "avatarUrl": null, "hostStats": { "hostScore": 0, "avgRating": 0, "recsCount": 0 } } }
```

### GET /hosts/:hostId/recommendations
- Auth: Not required
- Returns recommendations (max 100)

### POST /hosts/:hostId/recommendations
- Auth: Required
- Body example:
```json
{
  "ratings": { "overall": 5, "trust": 5, "accuracy": 5, "experience": 4 },
  "text": "Great host, speedy communication."
}
```
- Responses:
  - 201 Created: `{ "id": "...", "hostStats": { /* updated stats */ } }`
  - 400 Bad Request: if recommending yourself
  - 409 Conflict: if already recommended this host

---

## Bookings (planned) 📆
- There is no `bookings` route implemented yet. Proposed endpoints:
  - POST `/bookings` — create booking for a `listingId` with `dateFrom`, `dateTo` (auth required) → 201 `{ id: "..." }`
  - GET `/bookings/:id` — view booking (auth & ownership)
  - GET `/bookings/mine` — list my bookings
  - PATCH `/bookings/:id` — update booking status (cancel/accept)

Include validations:
- date overlaps, owner approval, listing active status.

---

## Error format examples ❌
- Validation / Bad request:
```json
{ "error": "Invalid input: 'title' is required" }
```
- Not found:
```json
{ "error": "Not found" }
```
- Conflict:
```json
{ "error": "Already recommended this host" }
```

---

## Notes & Conventions 🔧
- Dates returned are ISO strings.
- IDs for Mongo ObjectIds are stringified (e.g., `"652be9fa..."`).
- `users` uses Firebase `uid` as `_id` in the `users` collection.
- Validation is performed with `zod` (see schemas in route files).

---

If you'd like, I can:
- Add a `bookings` implementation scaffold in `src/routes/bookings.ts` (with tests), or
- Generate example cURL requests and a Postman collection from this spec.

---
*Generated from source files in `src/routes/` on repo.*
