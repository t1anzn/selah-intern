# Implementation Notes (Technical)

## Overview

Dashboard redesign to make user triage scannable for growth teams. Core concept: single unified risk signal with separate concerns for onboarding and delivery issues.

---

## Churn Risk Calculation

**File:** api/src/routes.ts

Risk Score (0–100) combines multiple factors:

- **Inactivity** (0–60 pts): Days since last read/reply, capped at 30 days
- **Subscription risk** (+20 pts): If past_due or canceled
- **Low read rate** (+10 pts): If < 50% emails read in last 7 days
- **Onboarding unpaid** (+15 to +35 pts): New users without active subscription
- **Paused adjustment** (−20 pts): Reduces risk if intentionally paused

Score is clamped to 0–100, then mapped to risk label:

- **Low:** 0–33
- **Medium:** 34–66
- **High:** 67–100

---

## Streak Calculation

**File:** api/src/routes.ts

Function `computeStreakFromIsoDays(days)` calculates two values from a user's read history:

- **Current streak:** The number of consecutive days of reading ending today (or most recent read date).
- **Longest streak:** The longest sequence of consecutive days ever recorded.

The calculation:

1. Extract unique ISO day strings from all reading events (deduped by date).
2. Sort dates in ascending order.
3. Scan through consecutive day numbers to find runs of 1-day gaps.
4. Track the longest run and the current run (from the end backwards).

This surfaces habit strength at a glance: a 7-day current streak + 30-day longest streak tells the team the user is consistent and has demonstrated commitment.

---

## Frontend Card Design

**Files:** web/src/components/UserCard.tsx, web/src/index.css

### Visual Hierarchy

- **Card border (left):** Color coded by risk label (red = high, orange = medium, gray = low)
- **Risk pill:** Displays meaning + risk label + inverted score

### Score Inversion

Displayed risk score = 100 − churnRisk, so lower numbers appear higher risk (matching visual/semantic convention). Label inversion: displayed 67–100 = "low", 34–66 = "medium", 0–33 = "high".

### Separate Concerns

- **Onboarding badge** (amber): Independent flag for new users, regardless of risk
- **Delivery issue badge** (red): Separate warning state for email delivery problems

### Detail Rows

Last read, streak, last reply, notes. No redundant summary line.

### Formatting Helpers

`UserCard` uses small local helpers to keep the JSX readable and the labels consistent:

- `formatDate`: converts ISO timestamps into a short locale date or an em dash when missing.
- `formatReadRecency` and `formatEngagementRecency`: turn day counts into human-readable recency labels like `Today`, `1 day ago`, or `No reads yet`.
- `isRecentlyJoined`: hides the joined date for established users and only surfaces it when it adds useful context.

---

## Separate Flags

**Onboarding Status:**

- New users without active subscription flagged with amber badge
- Does not affect risk color or calculation; purely informational

**Delivery Issues:**

- Indicates email delivery problem, separate from churn risk
- Displayed as red badge, independent of card border color

---

## API Routes

**File:** api/src/routes.ts

Primary endpoint:

- `GET /api/user-summaries`: Joins all tables, computes metrics, returns user summary array

Why this endpoint exists:

- It gives the frontend one aggregated payload instead of making the UI join or derive data itself.
- It keeps the card logic simple by centralizing risk scoring, streaks, and other derived values in the API.
- It reduces duplicate logic between the web app and backend by making the summary shape the single source of truth for the dashboard.

Read-only table endpoints:

- `/users`, `/preferences`, `/readings`, `/notes`, `/subscriptions`, `/payments`, `/email-history`, `/inbound-email-log`, `/user-daily-metrics`, `/daily-metrics`, `/bible-cache`, `/email-log`, `/stripe-webhook-events`, `/api-rate-limits`, `/cron-runs`

---

## Disengaged Users Endpoint

**File:** api/src/routes.ts, Endpoint: `GET /api/disengaged-users`

Identifies users who haven't read in the last 7 days and surfaces them with a 4-tier priority system:

### Scoring Algorithm

1. **Base risk:** `(daysSilent / 30) × 50`, capped at 50
2. **Multiplier:** Compares silence to user's personal reading gap; softened to prevent extreme spikes
3. **Clamp:** Final score clamped to 0–100

### Priority Buckets

- **Priority 3 (urgent) — Failed conversions:** Joined but never subscribed/engaged (≥7 days). Score floor ≥85.
- **Priority 3 (urgent) — Recent churn:** Unsubscribed but were previously reading. Score floor ≥80.
- **Priority 2 (high) — Onboarding stalls:** Subscribed but never read within first 14 days. Score floor ≥65.
- **Priority 1 (medium) — Long-term silence:** Subscribed, silent ≥30 days. Scores compressed to 70–80 range via soft compression toward baseline (65) + boost (+6).

### Long-Term Silence Scoring Detail

Instead of aggressively reducing scores, paying users with 30+ days silence get:

1. Soft compression: `baseline + (risk - baseline) × 0.25` pulls high scores toward 65
2. Additive boost: +6 to maintain visibility
3. Result: Scores cluster around 73–80 instead of 100, but ordering is preserved

This keeps long-term silent users visible without crowding urgent buckets.

### Sorting

Primary: by priority level (higher first)
Secondary: P1 users sorted by `daysSinceLastRead` (longest silent first)
Fallback: by disengagement risk

### Attention Flags

Users can have multiple flags: "No reads yet", "Onboarding stall", "Long-term silence", "Recent churn", "Failed conversion"

---

## Cancellation Date Tracking

**Files:** api/src/routes.ts

Both `/api/user-summaries` and `/api/disengaged-users` now include `daysSinceCanceled` (calculated from subscription's `canceledAt` timestamp):

- For canceled subscriptions: `Math.floor((now - canceledAt) / MS_PER_DAY)`
- For active subscriptions: `null`
- For users who never subscribed: `null`

### Frontend Display (DisengagedView)

- If `daysSinceCanceled` exists: shows subscription start date + tenure, then `→ Canceled X days ago` in red
- If unsubscribed but no cancellation date: shows `→ Canceled (missing date)` in red
- If never subscribed: shows "Never"

---

## Type Definitions

**File:** web/src/types.ts

### UserSummary

Shared frontend type for `GET /api/user-summaries`:

- `scores.churnRisk` (0–100): Raw risk score
- `scores.churnRiskLabel` ('low' | 'medium' | 'high'): Risk classification
- `hasDeliveryIssue` (boolean): Email reachability flag
- `subscription.canceledAt` (ISO string | null): When subscription was canceled

### DisengagedUser

Shared frontend type for `GET /api/disengaged-users`:

- `disengagementRisk` (0–100): Calculated risk score
- `priorityLevel` (0–3): Priority bucket (3 = urgent, 0 = normal)
- `attentionFlags` (string[]): Contextual flags like "Recent churn", "Failed conversion"
- `daysSinceCanceled` (number | null): Days since user unsubscribed
- `isFailedConversion`, `isRecentChurn`, `isOnboardingStall`, `isLongTermSilence`: Boolean detection flags
- Plus all core user fields: `id`, `email`, `name`, `daysSinceJoined`, `daysSinceLastRead`, `avgReadGap`, etc.

---

## Engagement Trends

**Files:** web/src/components/EngagementView.tsx, web/src/index.css, api/src/routes.ts

Task 3 treats engagement as two explicit signals:

- **Reads**: chapters opened
- **Replies**: notes created / replies sent

The chart uses a single toggle between **7 days**, **30 days**, and **all time** so the team can compare short-term and long-term momentum without switching views. The chart shows reads, replies, and a combined total line, with the combined line emphasized as the main summary signal.

Implementation details:

- Uses Recharts for the chart layer.
- Daily ranges render as daily points; all-time is grouped into weekly averages to keep the chart readable.
- Summary cards are split into current volume and trend cards, with the combined metric visually highlighted.
- Tooltip shows reads, replies, and combined volume for the selected day/week.

Why this shape:

- Reads are the primary signal because they show content consumption.
- Replies are kept separate because they show deeper interaction and are the clearest sign of active engagement.
- The combined line gives the growth team one quick momentum signal while still letting them see whether the change is driven by reads, replies, or both.
