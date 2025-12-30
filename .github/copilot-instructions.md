# Guidance for AI coding agents (shortstay-api)

## Quick summary
- Node + TypeScript Express API using MongoDB and Firebase Admin for auth.
- Dev: `npm run dev` (uses `ts-node-dev`). Build: `npm run build` (tsc). Start: `npm start` runs `dist/app.js`.
- Cloud Run focused: code assumes `0.0.0.0` + `process.env.PORT`. There's a `gcp-build` script for Cloud Build.

---

## Important files & where to look
- `src/app.ts` — app startup, CORS rules, health check (`/health`), route registration, global error handler.
- `src/config.ts` — required env vars (throws if `MONGODB_URI` missing).
- `src/db/mongo.ts` — Mongo connection helper (`getCollection`, `closeMongo`).
- `src/auth/firebase.ts` & `src/middleware/auth.ts` — Firebase Admin integration and `requireAuth` middleware (expects `Authorization: Bearer <idToken>`).
- `src/routes/*` — routes and validation examples (`zod` schemas). Examples: `CreateListingSchema` in `src/routes/listings.ts`.
- `src/utils/hostStats.ts` — background/manual recompute pattern for host stats; used after inserting recommendations.
- Root scripts: `package.json` (scripts: `dev`, `build`, `start`, `gcp-build`).
- Container: file named `dokerfile` (note: misspelled — not `Dockerfile`).

---

## Runtime & environment expectations (be explicit)
- Required: MONGODB_URI (process aborts if missing).
- Optional/defaults: MONGODB_DB (`shortstay`), PORT (3000 default), CORS_ORIGIN (`*`).
- Firebase Admin: uses `admin.credential.applicationDefault()` — Locally set `GOOGLE_APPLICATION_CREDENTIALS` JSON or run `gcloud auth application-default login`. On Cloud Run, provide a service account.
- Cloud Run: ensure container listens on `0.0.0.0` and uses `process.env.PORT`.

---

## Patterns & conventions to follow (concrete)
- Authentication: protected endpoints use `requireAuth` which reads `Authorization: Bearer <token>` and sets `req.user` (uid/email/name/picture).
- Mongo documents:
  - `users` collection uses firebase `uid` as `_id` (string). See `me` route which bootstraps user with `updateOne({ _id: u.uid }, { $setOnInsert: ... }, { upsert: true })`.
  - `listings`, `recommendations`, `rentalRequests` use ObjectId as `_id`.
- Validation: Zod schemas are used and *schemas live next to routes* (e.g., `CreateListingSchema` in `src/routes/listings.ts`). Throwing/parsing errors bubble to the global error handler which returns a 400 and logs error.
- Dates: the API expects ISO strings for dates and often converts with `new Date(str)` before storing.
- Pagination/sizing: endpoints limit results (e.g., `.limit(50)` for listings, `.limit(100)` for requests/recommendations).
- JSON body size limit: set to 2MB in `app.ts`.

---

## Deployment notes & gotchas
- The repository contains a `dokerfile` (typo) — automated builds expecting `Dockerfile` will fail unless you pass `-f dokerfile` or rename it. Fixing/renaming is recommended.
- `gcp-build` script: `npm install --only=dev && npm run build` — used in Google Cloud Build workflows.
- Logs: errors are console.logged by the global error handler — useful for Cloud Run stackdriver logs.

---

## Guidance for making changes safely (AI-focused)
- When adding a new route:
  1. Create a router file under `src/routes/`.
  2. Put validation near the top using `zod` and `parse()` the body.
  3. Use `getCollection<T>("<collectionName>")` for DB access.
  4. If route needs auth, add `requireAuth` middleware and use `req.user!.uid` for author/owner ids.
  5. Register router in `src/app.ts` (import + `app.use(...)`).
- When introducing new collections, follow existing naming and projection patterns and include an index if performance-critical.
- Prefer `updateOne(..., { upsert: true })` when you need to bootstrap user-like records.
- For changes affecting production behavior (CORS, ports, DB), list required env vars in `src/config.ts` and do not assume defaults silently.

---

## Tests & debugging
- There are no tests committed — use `npm run dev` to test endpoints locally.
- For Firebase-authenticated endpoints, either set `GOOGLE_APPLICATION_CREDENTIALS` locally or mock `verifyFirebaseIdToken` during unit tests.
- Use `closeMongo()` when writing integration tests to ensure connections close between runs.

---

## Quick examples (copy-paste style)
- Check id validity before DB lookups:
  - `if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });`
- Safe insertion + return id:
  - `const ins = await col.insertOne(doc as any); return res.status(201).json({ id: ins.insertedId.toString() });`

---

## Final notes
- Keep responses and errors consistent with current handlers (JSON shape `{ error: "..." }` or `{ items: [...] }`).
- Preserve the existing use of `zod` and `ObjectId` checks — these are project conventions.

If anything is unclear or you'd like me to expand examples or add templates (e.g., a route scaffold or PR checklist), tell me what to add and I will update this file. ✅