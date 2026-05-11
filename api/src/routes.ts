import { Router } from "express";
import { db } from "./data/db";

export const router = Router();

/** Number of milliseconds in one day. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parse an ISO-like date string and return a valid Date, or null when the input is missing or invalid.
 */
function asValidDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Return the latest valid ISO timestamp from a list of date-like values.
 */
function maxIsoDate(values: Array<string | null | undefined>): string | null {
  let max: Date | null = null;
  for (const value of values) {
    const date = asValidDate(value);
    if (!date) continue;
    if (!max || date > max) max = date;
  }
  return max ? max.toISOString() : null;
}

/**
 * Return the earliest valid ISO timestamp from a list of date-like values.
 */
function minIsoDate(values: Array<string | null | undefined>): string | null {
  let min: Date | null = null;
  for (const value of values) {
    const date = asValidDate(value);
    if (!date) continue;
    if (!min || date < min) min = date;
  }
  return min ? min.toISOString() : null;
}

/** Clamp a numeric value to an inclusive range. */
function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Build the summary payload used by the growth dashboard.
 *
 * The result is intentionally compact: it keeps the card UI focused on churn risk,
 * recent reading activity, subscription state, notes, and delivery issues.
 */
router.get("/user-summaries", (_req, res) => {
  const now = new Date();
  const since7d = new Date(now.getTime() - 7 * MS_PER_DAY);

  /** Format a date as YYYY-MM-DD in UTC, or return null for invalid input. */
  function isoDayString(value: string): string | null {
    const date = asValidDate(value);
    if (!date) return null;
    return date.toISOString().slice(0, 10);
  }

  /** Calculate the current and longest streak from a set of ISO day strings. */
  function computeStreakFromIsoDays(days: string[]): {
    current: number;
    longest: number;
  } {
    const uniqueDays = Array.from(new Set(days)).sort();
    if (uniqueDays.length === 0) return { current: 0, longest: 0 };

    const toDayNumber = (d: string) =>
      Math.floor(new Date(`${d}T00:00:00.000Z`).getTime() / MS_PER_DAY);
    const dayNums = uniqueDays.map(toDayNumber);

    let longest = 1;
    let run = 1;
    for (let i = 1; i < dayNums.length; i++) {
      if (dayNums[i] - dayNums[i - 1] === 1) {
        run++;
      } else {
        run = 1;
      }
      if (run > longest) longest = run;
    }

    let current = 1;
    for (let i = dayNums.length - 1; i > 0; i--) {
      if (dayNums[i] - dayNums[i - 1] === 1) current++;
      else break;
    }

    return { current, longest };
  }

  // For each user, gather related data and compute summary fields for the dashboard.
  const summaries = db.users.map((user) => {
    const preference = db.preferences.find((p) => p.userId === user.id) ?? null;
    const readings = db.readings.filter((r) => r.userId === user.id);
    const notes = db.notes.filter((n) => n.userId === user.id);
    const inbound = db.inboundEmailLog.filter((l) => l.userId === user.id);
    const subscriptions = db.subscriptions.filter((s) => s.userId === user.id);
    const payments = db.payments.filter((p) => p.userId === user.id);

    const lastReplyAt = maxIsoDate(inbound.map((l) => l.receivedAt));
    const lastSentAt = maxIsoDate(readings.map((r) => r.emailSentAt));
    const lastReadAt = maxIsoDate(readings.map((r) => r.markedReadAt));
    const firstReadAt = minIsoDate(readings.map((r) => r.markedReadAt));

    const daysSinceLastRead = (() => {
      const last = asValidDate(lastReadAt);
      if (!last) return null;
      return Math.floor((now.getTime() - last.getTime()) / MS_PER_DAY);
    })();

    const daysSinceLastReply = (() => {
      const last = asValidDate(lastReplyAt);
      if (!last) return null;
      return Math.floor((now.getTime() - last.getTime()) / MS_PER_DAY);
    })();

    const daysSinceJoined = (() => {
      const created = asValidDate(user.createdAt);
      if (!created) return null;
      return Math.floor((now.getTime() - created.getTime()) / MS_PER_DAY);
    })();

    const sent7d = readings.filter((r) => {
      const date = asValidDate(r.emailSentAt);
      return !!date && date >= since7d && date <= now;
    });

    const reads7d = sent7d.filter((r) => r.markedReadAt != null).length;

    const readDays = readings
      .map((r) => (r.markedReadAt ? isoDayString(r.markedReadAt) : null))
      .filter((d): d is string => !!d);
    const streak = computeStreakFromIsoDays(readDays);

    const activated = firstReadAt != null;

    const inactiveDays = daysSinceLastRead ?? daysSinceJoined;

    const latestSubscription = (() => {
      if (subscriptions.length === 0) return null;
      const latest = subscriptions.slice().sort((a, b) => {
        const aDate =
          asValidDate(a.updatedAt) ?? asValidDate(a.createdAt) ?? new Date(0);
        const bDate =
          asValidDate(b.updatedAt) ?? asValidDate(b.createdAt) ?? new Date(0);
        return bDate.getTime() - aDate.getTime();
      })[0];
      return latest ?? null;
    })();

    const successfulPayments = payments.filter(
      (p) => p.status === "succeeded" && p.paidAt != null,
    );
    const lifetimeValueCents = successfulPayments.reduce(
      (sum, p) => sum + (p.amountCents ?? 0),
      0,
    );

    // Churn risk is a heuristic score from 0 to 100 indicating the likelihood of a user churning, based on multiple factors.
    const churnRisk = (() => {
      const inactivity = inactiveDays ?? 0;
      const inactivityRisk = (clampNumber(inactivity, 0, 30) / 30) * 60;
      const subscriptionRisk =
        latestSubscription?.status === "past_due" ||
        latestSubscription?.status === "canceled"
          ? 20
          : 0;
      const readRate7d = sent7d.length > 0 ? reads7d / sent7d.length : null;
      const lowReadRisk = readRate7d != null && readRate7d < 0.5 ? 10 : 0;
      const isOnboarding =
        preference?.onboardingComplete === false || !activated;
      const isUnpaid = successfulPayments.length === 0;
      const onboardingUnpaidRisk =
        isOnboarding && isUnpaid
          ? daysSinceJoined != null && daysSinceJoined > 1
            ? 35
            : 15
          : 0;
      const pausedAdjustment = preference?.isPaused ? -20 : 0;

      const risk =
        inactivityRisk +
        subscriptionRisk +
        lowReadRisk +
        onboardingUnpaidRisk +
        pausedAdjustment;
      return Math.round(clampNumber(risk, 0, 100));
    })();

    // Churn risk label derived from the churn risk score buckets.
    const churnRiskLabel: "low" | "medium" | "high" = (() => {
      if (churnRisk >= 67) return "high";
      if (churnRisk >= 34) return "medium";
      return "low";
    })();

    const lastNoteAt = maxIsoDate(notes.map((n) => n.createdAt));

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      timezone: user.timezone,
      createdAt: user.createdAt,

      subscriptionStatus: preference?.subscriptionStatus ?? null,
      isPaused: preference?.isPaused ?? null,
      onboardingComplete: preference?.onboardingComplete ?? null,

      engagement: {
        lastReplyAt,
        daysSinceLastReply,
        lastReadAt,
        daysSinceLastRead,
      },

      activation: {
        activated,
      },

      streak,

      scores: {
        churnRisk,
        churnRiskLabel,
      },

      subscription: latestSubscription
        ? {
            planType: latestSubscription.planType,
            status: latestSubscription.status,
          }
        : null,

      revenue: {
        lifetimeValueCents,
      },

      notes: {
        total: notes.length,
        lastNoteAt,
      },

      hasDeliveryIssue: user.bounceCount > 0,
    };
  });

  res.json(summaries);
});

/**
 * Map raw data tables to read-only GET endpoints.
 *
 * This keeps the debugging surface small and predictable while exposing the
 * underlying in-memory collections directly.
 */
const tables = {
  users: () => db.users,
  preferences: () => db.preferences,
  readings: () => db.readings,
  notes: () => db.notes,
  subscriptions: () => db.subscriptions,
  payments: () => db.payments,
  "email-history": () => db.emailHistory,
  "inbound-email-log": () => db.inboundEmailLog,
  "user-daily-metrics": () => db.userDailyMetrics,
  "daily-metrics": () => db.dailyMetrics,
  "bible-cache": () => db.bibleCache,
  "email-log": () => db.emailLog,
  "stripe-webhook-events": () => db.stripeWebhookEvents,
  "api-rate-limits": () => db.apiRateLimits,
  "cron-runs": () => db.cronRuns,
} as const;

/** Register a GET route for each in-memory table. */
for (const [path, getter] of Object.entries(tables)) {
  router.get(`/${path}`, (_req, res) => {
    res.json(getter());
  });
}
