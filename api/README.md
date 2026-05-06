# Selah Intern Sandbox API

Mock API serving synthetic Selah data for the growth-tooling exercise.
All data lives in memory and is defined as static seed data in `src/data/db.ts`.

## Run

```bash
npm install
npm run dev
```

Server listens on `http://localhost:4000`.

## Collections

After starting the API, you can test the endpoints with either collection:

- Bruno: `Collections/Bruno`
- Postman: `Collections/Postman`

## Endpoints

Every endpoint returns a JSON array of all rows for that table.

```
GET /api/users
GET /api/preferences
GET /api/readings
GET /api/notes
GET /api/subscriptions
GET /api/payments
GET /api/email-history
GET /api/inbound-email-log
GET /api/user-daily-metrics
GET /api/daily-metrics
GET /api/bible-cache
GET /api/email-log
GET /api/stripe-webhook-events
GET /api/api-rate-limits
GET /api/cron-runs
```

## Seed data

50 synthetic users with deliberate engagement variance:

| Bucket | Count | Profile |
|---|---|---|
| Active | 20 | Replying regularly, recent reads, some notes |
| Mildly active | 10 | 60-80% read rate, intermittent gaps |
| Lapsed | 10 | No reply for 14-60 days |
| Paused | 5 | `preferences.isPaused = true` |
| Never started | 3 | Signed up, no replies |
| Churned | 2 | Subscription cancelled |

Reading history, notes, subscriptions, email history, inbound replies and metrics are static rows linked back to the users by numeric IDs.

## Adding endpoints

Edit `src/routes.ts`. Each table is exposed by adding a new entry to the
`tables` map.

## Schema reference

Types in `src/types.ts` mirror Selah's production Drizzle schema
(`selah-api/src/db/schema.ts`). The five infrastructure tables
(`bibleCache`, `emailLog`, `stripeWebhookEvents`, `apiRateLimits`,
`cronRuns`) are exposed as empty arrays.
