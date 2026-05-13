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
            createdAt: latestSubscription.createdAt,
            canceledAt: latestSubscription.canceledAt,
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
 * Surface users at risk of disengagement.
 *
 * A user is considered disengaged if they have not replied in the last 7 days.
 * The disengagement risk score measures how much a user went quiet relative to
 * their normal pattern:
 * - Base risk: how many days since their last reply (0-50 scale, capped at 30d)
 * - Multiplier: ratio of days silent to their average reply gap
 *
 * Example: A user who replies every 2 days going silent for 10 days is riskier
 * than a user who replies every 7 days going silent for 10 days, all else equal.
 */
router.get("/disengaged-users", (_req, res) => {
  const DISENGAGEMENT_THRESHOLD_DAYS = 7;
  const MIN_READS = 4;

  // Build the same summaries as /user-summaries, then filter and score.
  const now = new Date();
  const since7d = new Date(now.getTime() - 7 * MS_PER_DAY);

  function isoDayString(value: string): string | null {
    const date = asValidDate(value);
    if (!date) return null;
    return date.toISOString().slice(0, 10);
  }

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

  // Precompute cohort median of average read gaps from users with sufficient history.
  function median(values: number[]): number {
    if (values.length === 0) return 0;
    const s = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    if (s.length % 2 === 1) return s[mid];
    return (s[mid - 1] + s[mid]) / 2;
  }

  const cohortAvgGaps: number[] = [];
  for (const u of db.users) {
    const inbound = db.inboundEmailLog
      .filter((l) => l.userId === u.id)
      .map((l) => asValidDate(l.receivedAt))
      .filter((d): d is Date => d !== null)
      .map((d) => d.getTime())
      .sort((a, b) => b - a)
      .slice(0, 5);

    if (inbound.length >= MIN_READS) {
      const gaps: number[] = [];
      for (let i = 0; i < inbound.length - 1; i++) {
        gaps.push((inbound[i] - inbound[i + 1]) / MS_PER_DAY);
      }
      if (gaps.length > 0) {
        const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        cohortAvgGaps.push(avg);
      }
    }
  }

  const cohortMedianGap = Math.max(3, median(cohortAvgGaps) || 7);
  const MAX_EXPECTATION_MULTIPLIER = 3;

  // Compute disengaged users with risk scores.
  const disengaged = db.users
    .map((user) => {
      const readings = db.readings.filter((r) => r.userId === user.id);
      const subscriptions = db.subscriptions.filter((s) => s.userId === user.id);
      const readTimes = readings
        .map((r) => asValidDate(r.markedReadAt))
        .filter((d): d is Date => d !== null)
        .map((d) => d.getTime())
        .sort((a, b) => b - a)
        .slice(0, 5);

      const lastReadAt =
        readTimes.length > 0 ? new Date(readTimes[0]).toISOString() : null;
      const daysSinceJoined = (() => {
        const created = asValidDate(user.createdAt);
        if (!created) return null;
        return Math.floor((now.getTime() - created.getTime()) / MS_PER_DAY);
      })();
      const daysSinceLastRead = (() => {
        if (readTimes.length === 0) return daysSinceJoined;
        const last = new Date(readTimes[0]);
        return Math.floor((now.getTime() - last.getTime()) / MS_PER_DAY);
      })();

      // Only include users who have not read for 7+ days.
      if (
        daysSinceLastRead === null ||
        daysSinceLastRead < DISENGAGEMENT_THRESHOLD_DAYS
      ) {
        return null;
      }

      // Decide whether to trust personal median gap or fallback to cohort median.
      let avgReadGap: number;
      if (readTimes.length >= MIN_READS) {
        const gaps: number[] = [];
        for (let i = 0; i < readTimes.length - 1; i++) {
          gaps.push((readTimes[i] - readTimes[i + 1]) / MS_PER_DAY);
        }
        avgReadGap = gaps.length > 0 ? median(gaps) : cohortMedianGap;
      } else {
        avgReadGap = cohortMedianGap;
      }

      if (!isFinite(avgReadGap) || avgReadGap <= 0)
        avgReadGap = cohortMedianGap;

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

      const daysSinceSubscribed = (() => {
        if (!latestSubscription?.createdAt) return null;
        const subDate = asValidDate(latestSubscription.createdAt);
        if (!subDate) return null;
        return Math.floor((now.getTime() - subDate.getTime()) / MS_PER_DAY);
      })();

      const daysSinceCanceled = (() => {
        if (!latestSubscription?.canceledAt) return null;
        const cancelDate = asValidDate(latestSubscription.canceledAt);
        if (!cancelDate) return null;
        return Math.floor((now.getTime() - cancelDate.getTime()) / MS_PER_DAY);
      })();

      const subscriptionStatus = latestSubscription?.status ?? null;
      const isSubscribed =
        subscriptionStatus === "active" || subscriptionStatus === "trialing";
      const hasNeverRead = lastReadAt === null;
      const isFailedConversion = !isSubscribed && hasNeverRead && daysSinceJoined != null && daysSinceJoined >= 7;
      const isRecentChurn = !isSubscribed && !hasNeverRead;
      // Onboarding stall: subscribed but never opened first email within first 14 days of subscription
      const isOnboardingStall =
        isSubscribed && hasNeverRead && daysSinceSubscribed != null && daysSinceSubscribed < 14;
      // Long-term silence: subscribed but silent for 30+ days
      const isLongTermSilence =
        isSubscribed && daysSinceLastRead != null && daysSinceLastRead >= 30;

      const attentionFlags: string[] = [];
      if (hasNeverRead) attentionFlags.push("No reads yet");
      if (isOnboardingStall) attentionFlags.push("Onboarding stall");
      if (isLongTermSilence) attentionFlags.push("Long-term silence");
      if (isRecentChurn) attentionFlags.push("Recent churn");
      if (isFailedConversion) attentionFlags.push("Failed conversion");

      // Disengagement risk: how much they're deviating from their normal reading pattern.
      const daysQuietRisk = (clampNumber(daysSinceLastRead, 0, 30) / 30) * 50;

      const rawMultiplier = daysSinceLastRead / avgReadGap;
      const softened = Math.max(1, 1 + (rawMultiplier - 1) * 0.03);
      const expectationMultiplier = Math.min(
        MAX_EXPECTATION_MULTIPLIER,
        softened,
      );
      let disengagementRisk = Math.round(
        clampNumber(daysQuietRisk * expectationMultiplier, 0, 100),
      );

      // Recent churn signal: if unsubscribed but was previously engaged (low avg gap),
      // boost the score to reflect urgency of re-engagement or retention follow-up.
      if (isRecentChurn && avgReadGap < 7) {
        disengagementRisk = Math.max(disengagementRisk, 80);
      }

      // New subscriber onboarding urgency: if newly subscribed but hasn't opened first email,
      // boost score to prioritize onboarding follow-up or troubleshooting.
      if (isOnboardingStall && isSubscribed) {
        disengagementRisk = Math.max(disengagementRisk, 65);
      }

      // Failed conversion signal: joined but never subscribed and never engaged.
      // High priority for re-engagement or sales follow-up.
      if (isFailedConversion) {
        disengagementRisk = Math.max(disengagementRisk, 85);
      }

      // Long-term silence: flag as visible but don't aggressively penalize scores.
      // Instead of reducing their score, apply a reasonable ceiling so paying
      // long-term silent users remain visible but do not crowd urgent buckets.
      if (isLongTermSilence && isSubscribed) {
        // Long-term silent subscribers: compress high scores toward a baseline
        // so they don't sit at the extreme 100s, then apply a small boost to
        // keep visibility. This is not a hard cap; it's a soft compression.
        const BASELINE = 65;
        const COMPRESS_FACTOR = 0.25; // how strongly to pull high scores toward baseline
        const LONG_TERM_SILENCE_BOOST = 6;
        const compressed = Math.round(BASELINE + (disengagementRisk - BASELINE) * COMPRESS_FACTOR);
        disengagementRisk = Math.round(Math.min(100, compressed + LONG_TERM_SILENCE_BOOST));
      }

      // Priority buckets: higher priority items should surface first regardless of raw score.
      // 3 = urgent (failed conversion, recent churn)
      // 2 = high (onboarding stall)
      // 1 = medium (long-term silence)
      // 0 = normal
      let priorityLevel = 0;
      if (isFailedConversion || isRecentChurn) priorityLevel = 3;
      else if (isOnboardingStall) priorityLevel = 2;
      else if (isLongTermSilence) priorityLevel = 1;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        timezone: user.timezone,
        createdAt: user.createdAt,
        lastReadAt,
        daysSinceJoined,
        daysSinceLastRead,
        avgReadGap: Math.round(avgReadGap * 10) / 10, // round to 1 decimal
        subscriptionStatus,
        isSubscribed,
        hasNeverRead: lastReadAt === null,
        subscriptionCreatedAt: latestSubscription?.createdAt ?? null,
        daysSinceSubscribed,
        daysSinceCanceled,
        isRecentChurn,
        isOnboardingStall,
        isLongTermSilence,
        isFailedConversion,
        priorityLevel,
        attentionFlags,
        disengagementRisk,
      };
    })
    .filter((u): u is NonNullable<typeof u> => u !== null)
    .sort((a, b) => {
      // Primary: priority level (higher first)
      if (b.priorityLevel !== a.priorityLevel) return b.priorityLevel - a.priorityLevel;
      // For long-term silence bucket, order by who has been silent the longest
      if (a.priorityLevel === 1 && b.priorityLevel === 1) {
        return (b.daysSinceLastRead ?? 0) - (a.daysSinceLastRead ?? 0);
      }
      // Otherwise, fallback to disengagement risk
      return b.disengagementRisk - a.disengagementRisk;
    });

  res.json(disengaged);
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
