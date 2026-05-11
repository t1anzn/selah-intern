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

## Type Definitions

**File:** web/src/types.ts

Updated `UserSummary`:

- `UserSummary`: Shared frontend type for the aggregated dashboard payload returned by `GET /api/user-summaries`

- `scores.churnRisk` (0–100): Raw risk score
- `scores.churnRiskLabel` ('low' | 'medium' | 'high'): Risk classification
- `hasDeliveryIssue` (boolean): Email reachability flag
