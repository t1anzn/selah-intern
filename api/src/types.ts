export type User = {
  id: number;
  email: string;
  name: string | null;
  timezone: string;
  stripeCustomerId: string | null;
  utmData: Record<string, unknown> | null;
  onboardingData: Record<string, unknown> | null;
  deletedAt: string | null;
  bounceCount: number;
  lastBounceAt: string | null;
  createdAt: string;
};

export type SubscriptionStatus = 'free' | 'active' | 'past_due' | 'canceled' | 'trialing';

export type Preference = {
  id: number;
  userId: number;
  currentBook: string;
  currentChapter: number;
  bibleVersion: string;
  windowStart: string;
  windowEnd: string;
  weeklySummaryEnabled: boolean;
  skipWeekends: boolean;
  isPaused: boolean;
  onboardingComplete: boolean;
  subscriptionStatus: SubscriptionStatus;
  scheduledSendTime: string | null;
  scheduledSendDate: string | null;
  dailySendAttempts: number;
  lastAttemptAt: string | null;
  splitLongChapters: boolean;
  splitThresholdMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export type Reading = {
  id: number;
  userId: number;
  book: string;
  chapter: number;
  bibleVersion: string;
  markedReadAt: string | null;
  emailSentAt: string;
  emailMessageId: string;
  isCurrent: boolean;
  isPreview: boolean;
  partNumber: number | null;
  totalParts: number | null;
  startVerse: number | null;
  endVerse: number | null;
  lastResentAt: string | null;
  createdAt: string;
};

export type Note = {
  id: number;
  userId: number;
  readingId: number;
  content: string;
  createdAt: string;
};

export type Subscription = {
  id: number;
  userId: number;
  stripeSubscriptionId: string;
  planType: 'weekly' | 'yearly';
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Payment = {
  id: number;
  userId: number;
  subscriptionId: number | null;
  stripeInvoiceId: string | null;
  stripePaymentIntentId: string | null;
  amountCents: number;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
};

export type EmailHistory = {
  id: number;
  userId: number;
  emailType: string;
  rawBody: string;
  parsedResult: string;
  createdAt: string;
};

export type InboundEmailLog = {
  id: number;
  userId: number;
  messageId: string | null;
  parsedCommand: string | null;
  receivedAt: string;
};

export type UserDailyMetrics = {
  id: number;
  userId: number;
  date: string;
  chaptersSent: number;
  chaptersRead: number;
  notesCreated: number;
  commandsUsed: number;
  llmCalls: number;
  llmInputTokens: number;
  llmOutputTokens: number;
  createdAt: string;
};

export type DailyMetrics = {
  id: number;
  date: string;
  totalUsers: number;
  activeUsers: number;
  engagedUsers: number;
  newUsers: number;
  pausedUsers: number;
  chaptersSent: number;
  chaptersRead: number;
  notesCreated: number;
  llmCalls: number;
  llmInputTokens: number;
  llmOutputTokens: number;
  avgTimeToReadMinutes: number | null;
  createdAt: string;
};

export type BibleCache = {
  id: number;
  book: string;
  chapter: number;
  version: string;
  content: string;
  createdAt: string;
};

export type EmailLog = {
  id: number;
  userId: number;
  emailType: string;
  sentAt: string;
};

export type StripeWebhookEvent = {
  id: number;
  eventId: string;
  eventType: string;
  processedAt: string;
};

export type ApiRateLimit = {
  id: number;
  key: string;
  endpoint: string;
  createdAt: string;
};

export type CronRun = {
  jobName: string;
  startedAt: string;
  completedAt: string | null;
};

export type Database = {
  users: User[];
  preferences: Preference[];
  readings: Reading[];
  notes: Note[];
  subscriptions: Subscription[];
  payments: Payment[];
  emailHistory: EmailHistory[];
  inboundEmailLog: InboundEmailLog[];
  userDailyMetrics: UserDailyMetrics[];
  dailyMetrics: DailyMetrics[];
  bibleCache: BibleCache[];
  emailLog: EmailLog[];
  stripeWebhookEvents: StripeWebhookEvent[];
  apiRateLimits: ApiRateLimit[];
  cronRuns: CronRun[];
};
