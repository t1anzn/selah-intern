import type { UserSummary } from "../types";

type Props = {
  user: UserSummary;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function formatEngagementRecency(days: number | null): string {
  if (days == null) return "No replies yet";
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function formatReadRecency(days: number | null): string {
  if (days == null) return "No reads yet";
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function UserCard({ user }: Props) {
  const subscriptionLabel = user.subscription
    ? `${user.subscription.status} · ${user.subscription.planType}`
    : (user.subscriptionStatus ?? "unknown");
  const daysSinceReply = user.engagement.daysSinceLastReply;
  const daysSinceRead = user.engagement.daysSinceLastRead;

  // Helper: check if user joined within the last 7 days
  function isRecentlyJoined(
    createdAt: string | null,
    days: number = 7,
  ): boolean {
    if (!createdAt) return false;
    const created = new Date(createdAt);
    if (Number.isNaN(created.getTime())) return false;
    const now = new Date();
    const diffDays =
      (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays < days;
  }

  const daysSinceLastActivity = (() => {
    const candidates = [daysSinceRead, daysSinceReply].filter(
      (n): n is number => n != null,
    );
    if (candidates.length === 0) return null;
    return Math.min(...candidates);
  })();

  const isNew =
    !user.activation.activated && isRecentlyJoined(user.createdAt, 7);
  const showJoined = isNew || daysSinceLastActivity == null;

  const isOnboardingUser =
    user.onboardingComplete === false || !user.activation.activated;

  // Displayed risk score is inverse of churn risk, so that higher is better for intuitive understanding.
  const displayedRiskScore = 100 - user.scores.churnRisk;
  const displayedRiskLabel = (() => {
    if (displayedRiskScore >= 67) return "low";
    if (displayedRiskScore >= 34) return "medium";
    return "high";
  })();

  const cardToneClass = `user-card--risk-${displayedRiskLabel}`;

  // Risk signal: Container for label + score.
  function riskPill() {
    const isUnpaid = user.revenue.lifetimeValueCents <= 0;
    const daysSinceSignup = (() => {
      if (!user.createdAt) return null;
      const created = new Date(user.createdAt);
      if (Number.isNaN(created.getTime())) return null;
      return Math.floor(
        (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24),
      );
    })();
    const isOverdueUnpaidOnboarding =
      isOnboardingUser &&
      isUnpaid &&
      daysSinceSignup != null &&
      daysSinceSignup > 1;
    const label =
      displayedRiskLabel.charAt(0).toUpperCase() + displayedRiskLabel.slice(1);
    const meta = `${label} risk`;
    const meaning = (() => {
      if (isOverdueUnpaidOnboarding) return "Payment overdue";
      if (displayedRiskLabel === "high") return "Needs attention";
      if (displayedRiskLabel === "medium") return "Monitor";
      return "Low risk";
    })();
    return (
      <span className={`risk-pill risk-pill--${displayedRiskLabel}`}>
        <span className="risk-pill__main">
          <span className="risk-pill__meaning">{meaning}</span>
          <span className="risk-pill__meta">{meta}</span>
        </span>
        <span className="risk-pill__score">{displayedRiskScore}</span>
      </span>
    );
  }

  return (
    <article className={`user-card user-card--dense ${cardToneClass}`}>
      <div className="user-card__header user-card__header--dense">
        <div>
          <div className="user-card__title-row">
            {riskPill()}
            <h2 className="user-card__name">{user.name ?? "Unnamed user"}</h2>
          </div>
          <p className="user-card__email">{user.email}</p>
        </div>
        <div className="user-card__badges">
          <span className="badge">Subscription: {subscriptionLabel}</span>
          {user.isPaused ? <span className="badge">paused</span> : null}
          {user.onboardingComplete === false ? (
            <span className="badge badge--onboarding">onboarding</span>
          ) : null}
          {user.hasDeliveryIssue ? (
            <span className="badge badge--delivery-issue">⚠️ Bouncing</span>
          ) : null}
        </div>
      </div>
      <dl className="user-card__details user-card__details--dense">
        {showJoined ? (
          <div className="detail detail--dense">
            <dt>Joined</dt>
            <dd>{formatDate(user.createdAt)}</dd>
          </div>
        ) : null}
        <div className="detail detail--dense">
          <dt>Last read</dt>
          <dd>
            {formatReadRecency(user.engagement.daysSinceLastRead)}
            {user.engagement.lastReadAt
              ? ` · ${formatDate(user.engagement.lastReadAt)}`
              : ""}
          </dd>
        </div>
        <div className="detail detail--dense">
          <dt>Streak</dt>
          <dd>
            {user.streak.current} current · {user.streak.longest} longest
          </dd>
        </div>
        <div className="detail detail--dense">
          <dt>Last reply</dt>
          <dd>{formatEngagementRecency(user.engagement.daysSinceLastReply)}</dd>
        </div>
        <div className="detail detail--dense">
          <dt>Notes</dt>
          <dd>
            {user.notes.total}
            {user.notes.lastNoteAt
              ? ` · last ${formatDate(user.notes.lastNoteAt)}`
              : ""}
          </dd>
        </div>
      </dl>
    </article>
  );
}
