# Selah growth-tooling exercise

## Task 1: User card details

I expanded each user card so a growth team can understand the user at a glance without opening a detail page. The main goal was to make one card answer three main questions quickly:

1. Is this user at risk of churning?
2. Are they actively reading and replying?
3. Is there anything operational that needs attention right now?

The final card keeps the most important signal front and center: a single churn-risk pill. That pill includes a label and a number, but the number is intentionally inverted so the visual meaning stays intuitive. Lower displayed numbers mean higher risk, which makes the card easier to scan because the score, color, and wording all point in the same direction.

### What each card shows

- **Name and email**: the user’s identity and primary contact, so the card is immediately recognizable.
- **Subscription state**: shown as a badge because it is a business-status flag, not a behavior metric.
- **Paused badge**: keeps intentional pauses visible without making them look like churn.
- **Onboarding badge**: highlights users who are still early in the journey, where low activity can mean they just have not started yet.
- **Delivery issue badge**: separates email reachability problems from engagement problems, since a bounced address is a different kind of follow-up than a disengaged user.
- **Joined date**: shown only when it adds context, especially for new users or users with no activity yet.
- **Last read**: the strongest day-to-day engagement signal, because it tells the team how recently the user actually consumed content.
- **Streak**: gives a quick sense of habit strength, not just one-off activity.
- **Last reply**: shows whether the user is still responding to messages, which matters for outreach and support.
- **Notes count and most recent note**: surfaces internal context so the team can see whether anyone has already captured useful follow-up information.

### Why these fields

I chose fields that help the team decide what to do next, not just fields that are interesting to store. The card favors recency, habit, and operational flags because those are the things that change the response:

- If a user has not read recently, the team may want to re-engage them.
- If a user has a strong streak, they are probably healthy even if they have not replied lately.
- If a user is onboarding, low activity is less alarming than it is for an established user.
- If a user is bouncing, the issue is deliverability first, not churn.

That is why the card does not try to show every available metric. It uses a compact set of fields that are actionable and keep the visual hierarchy simple.

### Design choice summary

- Behavioral context appears as short supporting details.
- Operational issues stay separate from churn so they do not muddy the risk signal.
- Less important data stays out of the headline area so the card remains scannable.

This gave the dashboard a cleaner structure: the team can scan the grid for the risk pill and badges first, then read the supporting details only when they need more context.

## Task 1.1: Scale

At 50 users, the current in-memory setup is fine for prototyping. At 5,000 I wouldn't expect the app to fail immediately, but would expect the dashboard to start becoming inefficient and noticeably slower. The main scaling issues would begin with backend computation and frontend rendering rather than raw infrastructure limits.

### What breaks first

The first bottleneck is the backend endpoint that builds user summaries. For every user, it repeatedly scans whole arrays with `.find()` and `.filter()`:

```typescript
const preference = db.preferences.find((p) => p.userId === user.id) ?? null;
const readings = db.readings.filter((r) => r.userId === user.id);
const notes = db.notes.filter((n) => n.userId === user.id);
const inbound = db.inboundEmailLog.filter((l) => l.userId === user.id);
const subscriptions = db.subscriptions.filter((s) => s.userId === user.id);
const payments = db.payments.filter((p) => p.userId === user.id);
```

With 5,000 users, that becomes a lot of repeated table scans plus date parsing and churn-score calculation for every card. I would describe the overall work as roughly O(n^2) if the related tables grow with the user count.

The second bottleneck would likely be the frontend. The dashboard currently fetches and displays every user card at once, which means React has to create and manage thousands of components simultaneously. Even if the API remained fast enough, the page would likely become slower to load, use more browser memory, and feel laggy when scrolling.

### What I would change, in order

1. **Add pagination to the API.** Instead of returning every summary at once, I would start with something like `/api/user-summaries?page=1&limit=50`. This would reduce backend computation per request, shrink response payload sizes, and stop the frontend from needing to load and render thousands of cards simultaneously.

2. **Add filtering and sorting.** The growth team probably cares most about high-risk, inactive, or failed-subscription users. Letting them query those slices means the app does less work and returns less data than needed, improving the efficiency.

3. **Improve in-memory lookups.** Instead of repeatedly scanning arrays with `.filter()` and `.find()` for every user summary, I would group related records by `userId` in memory first. For example, rather than looping through every reading to find a user’s records each time, the backend could build a lookup object like `readingsByUser[userId]` once and reuse it across all summaries. That would allow the backend to retrieve related data through direct lookups instead of repeatedly scanning entire datasets, significantly reducing unnecessary computation.

4. **Update summary data asynchronously.** Instead of recalculating churn risk, streaks, and engagement metrics every time the endpoint is called, I would move these calculations into background jobs or scheduled cron jobs. That would make requests faster because the dashboard would mostly read precomputed summary data.

5. **Move to a real database when the data model grows.** Once the dashboard needs persistence, better concurrency, or more complex querying, I would move the summary data into SQLite first, then Postgres if the product outgrows that.

### Database considerations

I would not start with a database migration for 5,000 users alone. My position is that pagination and better in-memory lookups would provide the biggest performance improvements with the least added complexity. A database becomes the right next step when the app needs persistence, indexes, or multiple processes reading and writing the same data.

### Where I am uncertain

- I am unsure how fresh the dashboard data needs to be. If near real-time updates are important, cron-job-based summary updates may not be sufficient and a more event-driven approach could be needed.

- I am also unsure whether it would be better long-term to calculate metrics like churn risk, streaks, and engagement dynamically from the database each request, or precompute and store them per user. Precomputing would improve performance, but it also adds complexity around making sure the stored metrics stay updated whenever the underlying user activity changes.

- I am also uncertain how many internal users would be accessing the dashboard at the same time. 5,000 stored users may still be manageable on a single server, but multiple people making requests simultaneously could increase backend load and change where the main bottlenecks appear.

## Task 2 — Disengaged users

I defined a disengaged user as someone who has not read in the last 7 days. The goal was to make a short, practical list of people the team should contact first.

The score is simple: the longer someone has gone without reading, the higher their risk. I also compare that silence with their usual reading pattern so the list can distinguish between someone who is normally active and someone who reads less often.

To keep the score easy to read, I only use a personal reading pattern when there is enough history. If there are too few reads, I fall back to the group average instead. I also cap the final multiplier so the list does not fill up with many users showing the same maximum score.

I also flag and score people into four priority buckets to align action with business impact:

- **Priority 3 (urgent) - Failed conversions**: Joined but never subscribed or engaged (≥7 days) — acquisition funnel failure. These are urgent and receive a high minimum score (≥85).
- **Priority 3 (urgent)— Recent churn**: Unsubscribed but were reading actively before — retention failure. These are urgent and receive a high minimum score (≥80).
- **Priority 2 (high) — Onboarding stalls**: Subscribed but never opened a first email (within 14 days of subscribing) — activation friction. These are high priority and get a minimum score (≥65).
- **Priority 1 (medium) — Long-term silence**: Subscribed but silent for 30+ days — visible but lower relative risk. Their scores are compressed to the 70–80 range so they stay visible but don't overshadow urgent cases like recent churn. Within this bucket, users are ordered by who has been silent the longest.

We sort results by priority first, then by score. For the long-term-silence bucket the sort specifically orders by `daysSinceLastRead` (longest silent first) so the team can address the oldest silent accounts first.

This keeps the list focused on the right business problems in order of priority: Acquisition failures and recent churn are handled first, then activation issues, then long-term maintenance or reactivation efforts.

This keeps the list simple and actionable: who to reach out to and in what order.

### Where I am uncertain

- I am unsure whether 7 days is the right disengagement threshold long-term. It works as a simple baseline, but the ideal timeframe may depend on how often users are expected to read emails in normal usage.

- I chose to focus on reading behavior rather than replies because opening and consuming content feels like a more reliable engagement signal. However, I am uncertain whether some highly engaged users may still be underrated if they mainly engage through replies or other actions outside the tracked read data.

- I am also uncertain about where to cut off users who have been disengaged for a very long time. At some point, users who have been inactive for months may no longer be realistically recoverable, so continuing to rank them alongside recently disengaged users could reduce the usefulness of the outreach list.

- Consider sporadic users: some users read infrequently by habit (monthly or irregularly) and may appear as long-term silent despite still being a satisfied paying customer. The current soft-compression + small boost approach attempts to keep these paying but infrequent users visible without treating them as urgent. We should revisit this heuristic after observing its behavior in production and consider cohort-aware thresholds or additional signals (e.g., payment activity, reply frequency) to avoid unnecessary outreach.
