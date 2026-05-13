export type User = {
  id: number;
  email: string;
  name: string | null;
  timezone: string;
  createdAt: string;
};

export type DisengagedUser = {
  id: number;
  email: string;
  name: string | null;
  timezone: string;
  createdAt: string;
  lastReadAt: string | null;
  daysSinceJoined: number | null;
  daysSinceLastRead: number;
  avgReadGap: number;
  subscriptionStatus: "active" | "trialing" | "past_due" | "canceled" | null;
  isSubscribed: boolean;
  hasNeverRead: boolean;
  subscriptionCreatedAt: string | null;
  daysSinceSubscribed: number | null;
  daysSinceCanceled: number | null;
  isRecentChurn: boolean;
  isOnboardingStall: boolean;
  isLongTermSilence: boolean;
  isFailedConversion: boolean;
  priorityLevel: number;
  attentionFlags: string[];
  disengagementRisk: number;
};

export type UserSummary = {
  id: number;
  email: string;
  name: string | null;
  timezone: string;
  createdAt: string;

  subscriptionStatus: string | null;
  isPaused: boolean | null;
  onboardingComplete: boolean | null;

  engagement: {
    lastReplyAt: string | null;
    daysSinceLastReply: number | null;
    lastReadAt: string | null;
    daysSinceLastRead: number | null;
  };

  activation: {
    activated: boolean;
  };

  streak: {
    current: number;
    longest: number;
  };

  scores: {
    churnRisk: number;
    churnRiskLabel: "low" | "medium" | "high";
  };

  subscription: {
    planType: "weekly" | "yearly";
    status: "active" | "past_due" | "canceled" | "trialing";
  } | null;

  revenue: {
    lifetimeValueCents: number;
  };

  notes: {
    total: number;
    lastNoteAt: string | null;
  };

  hasDeliveryIssue: boolean;
};
