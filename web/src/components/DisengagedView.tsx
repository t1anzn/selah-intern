import type { DisengagedUser } from "../types";

interface DisengagedViewProps {
  users: DisengagedUser[];
  loading: boolean;
  error: string | null;
}

export function DisengagedView({ users, loading, error }: DisengagedViewProps) {
  if (loading) {
    return <p className="state">Loading disengaged users...</p>;
  }

  if (error) {
    return <p className="state state--error">Error: {error}</p>;
  }

  if (users.length === 0) {
    return <p className="state">No disengaged users. Great engagement!</p>;
  }

  return (
    <section className="disengaged-list">
      <div className="disengaged-header">
        <span className="col-name">Name / Email</span>
        <span className="col-silent">Days Silent</span>
        <span className="col-gap">Avg Read Gap</span>
        <span className="col-last-reply">Last Read</span>
        <span className="col-subscribed">Days Subscribed</span>
        <span className="col-risk">Risk Score</span>
      </div>

      {users.map((user) => {
        let riskColor = "#388e3c";
        if (user.isFailedConversion) {
          riskColor = "#e53935";
        } else if (user.isRecentChurn) {
          riskColor = "#c62828";
        } else if (user.isOnboardingStall && user.isSubscribed) {
          riskColor = "#f57c00";
        } else if (user.disengagementRisk >= 70) {
          riskColor = "#d32f2f";
        } else if (user.disengagementRisk >= 40) {
          riskColor = "#f57c00";
        }

        const getFlagColor = (flag: string): string => {
          if (flag.includes("Recent churn")) return "#c62828";
          if (flag.includes("Failed conversion")) return "#e53935";
          if (flag.includes("Onboarding stall")) return "#f57c00";
          if (flag.includes("Long-term silence")) return "#f57c00";
          if (flag.includes("No active subscription")) return "#d32f2f";
          if (flag.includes("No reads yet")) return "#666";
          return "#999";
        };

        return (
          <div
            key={user.id}
            className="disengaged-row"
            style={{ borderLeftColor: riskColor }}
          >
            <div className="col-name">
              <div className="user-name">{user.name || "Unknown"}</div>
              <div className="user-email">{user.email}</div>
              <div className="flags-container">
                <span
                  className="flag-pill"
                  style={{
                    backgroundColor: user.isSubscribed ? "#4caf50" : "#d32f2f",
                  }}
                >
                  {user.isSubscribed ? "Subscribed" : "Not subscribed"}
                </span>
                {user.attentionFlags.map((flag) => (
                  <span
                    key={flag}
                    className="flag-pill"
                    style={{ backgroundColor: getFlagColor(flag) }}
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </div>
            <div className="col-silent">
              {user.lastReadAt
                ? `${user.daysSinceLastRead} days`
                : `${user.daysSinceJoined ?? user.daysSinceLastRead} days since join`}
            </div>
            <div className="col-gap">{user.avgReadGap} days</div>
            <div className="col-last-reply">
              {user.lastReadAt
                ? new Date(user.lastReadAt).toLocaleDateString()
                : "No reads yet"}
            </div>
            <div className="col-subscribed">
              {user.daysSinceCanceled !== null ? (
                <div style={{ fontSize: "12px", lineHeight: "1.4" }}>
                  <div>
                    {user.subscriptionCreatedAt &&
                    user.daysSinceSubscribed !== null
                      ? `${new Date(user.subscriptionCreatedAt).toLocaleDateString()} (${user.daysSinceSubscribed} days)`
                      : "N/A"}
                  </div>
                  <div style={{ fontWeight: "600", color: "#c62828" }}>
                    → Canceled {user.daysSinceCanceled} days ago
                  </div>
                </div>
              ) : !user.isSubscribed && user.subscriptionCreatedAt ? (
                <div style={{ fontSize: "12px", lineHeight: "1.4" }}>
                  <div>
                    {user.daysSinceSubscribed !== null
                      ? `${new Date(user.subscriptionCreatedAt).toLocaleDateString()} (${user.daysSinceSubscribed} days)`
                      : "N/A"}
                  </div>
                  <div style={{ fontWeight: "600", color: "#c62828" }}>
                    → Canceled (missing date)
                  </div>
                </div>
              ) : user.subscriptionCreatedAt &&
                user.daysSinceSubscribed !== null ? (
                `${new Date(user.subscriptionCreatedAt).toLocaleDateString()} (${user.daysSinceSubscribed} days)`
              ) : (
                "Never"
              )}
            </div>
            <div className="col-risk">
              <span
                className="risk-badge"
                style={{ backgroundColor: riskColor }}
              >
                {user.disengagementRisk}
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
