# ShortStay API

A stateless backend service that powers a short-term rental discovery platform (Airbnb-like) without payments and without chat. Trust is built through a host recommendation system.

## Architecture

- **Runtime**: Google Cloud Run (Node.js/TypeScript + Express)
- **Authentication**: Firebase Authentication (Google sign-in)
- **Database**: MongoDB Atlas
- **File Storage**: Firebase Storage (client direct upload, backend stores references)
- **Region**: me-central1

## Deployment

**Production URL**: https://shortstay-api-170811910466.me-central1.run.app

### Local Development
```bash
npm install
npm run dev
```

### Build & Deploy
```bash
# Build locally
npm run build

# Deploy to Cloud Run
gcloud run deploy shortstay-api --source . --region me-central1
```

### Environment Setup
Set these environment variables in Cloud Run:
```bash
gcloud run services update shortstay-api \
  --region=me-central1 \
  --set-env-vars="MONGODB_URI=mongodb+srv://...,MONGODB_DB=shortstay,CORS_ORIGIN=https://yourdomain.com"
```

## Product Scope

### Supported (MVP)
- **User bootstrap/profile** (`/me`)
- **Listings**: Search/list, view details, create (authenticated)
- **Hosts**: View profile + trust stats (Host Score), view recommendations, create recommendation (authenticated; one per host per author)
- **Rental requests**: Create request (authenticated), browse by area, view "my requests"
- **Host trust aggregation**: Host Score recalculated on recommendation write
- **Health check endpoint**

### Out of Scope
- Payments
- Chat/messaging
- Booking engine/reservation confirmation
- Identity verification (KYC)
- Review-to-stay verification

## Authentication Model

**Client Flow:**
1. Client signs in with Google via Firebase Auth
2. Firebase returns ID token
3. Client calls backend with `Authorization: Bearer <FIREBASE_ID_TOKEN>`

**Backend Verification:**
- Firebase Admin verifies token and extracts `uid`, `email`, `name`, `picture`
- Uses `uid` as internal user identifier in MongoDB

## Data Model

### users
```
_id: Firebase UID
email, name, avatarUrl
hostStats: { hostScore, avgRating, recsCount, updatedAt }
```

### listings
```
ownerId: Firebase UID
title, area, pricePerNight, description, availabilityText
status: ACTIVE | INACTIVE
images: [{ storagePath }]
createdAt, updatedAt
```

### recommendations
```
hostId, authorId: Firebase UIDs
ratings: { overall, trust, accuracy, experience } (1-5)
text, hidden, createdAt
Unique constraint: one per host per author
```

### rentalRequests
```
authorId: Firebase UID
area, dateFrom, dateTo, budgetMax, text
status: ACTIVE | CLOSED
createdAt, updatedAt
```

## API Endpoints

### Public
- `GET /health`
- `GET /listings?area=&priceMax=&status=`
- `GET /listings/:id`
- `GET /hosts/:hostId`
- `GET /hosts/:hostId/recommendations`
- `GET /requests?area=...`

### Authenticated
- `GET /me`
- `POST /listings`
- `POST /hosts/:hostId/recommendations`
- `POST /requests`
- `GET /requests/mine`

## Configuration

### Environment Variables
- `PORT` (Cloud Run default: 8080)
- `MONGODB_URI` (Atlas connection string)
- `MONGODB_DB` (default: shortstay)
- `CORS_ORIGIN` (frontend domain)

### Firebase Admin
- Uses Application Default Credentials on Cloud Run
- No service account key file required

## Host Trust System

**Host Score Calculation:**
- Triggered on recommendation creation/updates
- Combines average rating + bounded count boost
- Stored in `users.hostStats` (authoritative source)
- Range: 0-5

## Deployment

```bash
gcloud run deploy shortstay-api --source . --region me-central1
```

## Implementation Details

### Project Structure
```
src/
├── auth/firebase.ts          # Firebase Admin SDK setup
├── middleware/auth.ts        # Authentication middleware
├── db/mongo.ts              # MongoDB connection & helpers
├── routes/
│   ├── me.ts                # User profile endpoints
│   ├── listings.ts          # Listing CRUD operations
│   ├── hosts.ts             # Host profiles & recommendations
│   └── requests.ts          # Rental request operations
├── utils/hostStats.ts       # Host score calculation
├── config.ts                # Environment configuration
└── app.ts                   # Express app setup
```

### Request/Response Examples

**Create Listing:**
```bash
POST /listings
Authorization: Bearer <firebase-token>
{
  "title": "Cozy Downtown Apartment",
  "area": "Tel Aviv",
  "pricePerNight": 150,
  "description": "Beautiful apartment in the heart of the city",
  "availabilityText": "Available weekends",
  "images": [{"storagePath": "listings/abc123.jpg"}]
}
```

**Create Recommendation:**
```bash
POST /hosts/{hostId}/recommendations
Authorization: Bearer <firebase-token>
{
  "ratings": {
    "overall": 5,
    "trust": 5,
    "accuracy": 4,
    "experience": 5
  },
  "text": "Great host, very responsive and helpful!"
}
```

### Database Indexes
Recommended MongoDB indexes for optimal performance:
```javascript
// recommendations collection
db.recommendations.createIndex({ "hostId": 1, "authorId": 1 }, { unique: true })
db.recommendations.createIndex({ "hostId": 1, "hidden": 1, "createdAt": -1 })

// listings collection
db.listings.createIndex({ "area": 1, "status": 1 })
db.listings.createIndex({ "ownerId": 1 })

// rentalRequests collection
db.rentalRequests.createIndex({ "area": 1, "status": 1, "createdAt": -1 })
db.rentalRequests.createIndex({ "authorId": 1 })
```

## Error Handling

- **401**: Missing/invalid Firebase token
- **400**: Invalid request payload (Zod validation)
- **404**: Resource not found
- **409**: Conflict (e.g., duplicate recommendation)
- **503**: Database unavailable (health check)

Set environment variables via Cloud Run console or CLI.

## Future Extensions
- Listing image workflows
- Content moderation
- Admin endpoints
- Improved search (geo, full-text)
- Email workflows
- Booking/payments (excluded for now)