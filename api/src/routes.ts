import { Router } from 'express';
import { db } from './data/db';

export const router = Router();

const tables = {
  users: () => db.users,
  preferences: () => db.preferences,
  readings: () => db.readings,
  notes: () => db.notes,
  subscriptions: () => db.subscriptions,
  payments: () => db.payments,
  'email-history': () => db.emailHistory,
  'inbound-email-log': () => db.inboundEmailLog,
  'user-daily-metrics': () => db.userDailyMetrics,
  'daily-metrics': () => db.dailyMetrics,
  'bible-cache': () => db.bibleCache,
  'email-log': () => db.emailLog,
  'stripe-webhook-events': () => db.stripeWebhookEvents,
  'api-rate-limits': () => db.apiRateLimits,
  'cron-runs': () => db.cronRuns,
} as const;

for (const [path, getter] of Object.entries(tables)) {
  router.get(`/${path}`, (_req, res) => {
    res.json(getter());
  });
}
