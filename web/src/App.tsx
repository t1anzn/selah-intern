import { useEffect, useState } from "react";
import { UserCard } from "./components/UserCard";
import { DisengagedView } from "./components/DisengagedView";
import type { UserSummary, DisengagedUser } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<"all" | "disengaged">("all");

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [disengaged, setDisengaged] = useState<DisengagedUser[]>([]);
  const [disengagedLoading, setDisengagedLoading] = useState(false);
  const [disengagedError, setDisengagedError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user-summaries")
      .then((res) => {
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        return res.json();
      })
      .then((data: UserSummary[]) => setUsers(data))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Unknown error"),
      )
      .finally(() => setLoading(false));
  }, []);

  const handleTabChange = (tab: "all" | "disengaged") => {
    setActiveTab(tab);

    // Fetch disengaged users only when switching to that tab.
    if (tab === "disengaged" && disengaged.length === 0 && !disengagedLoading) {
      setDisengagedLoading(true);
      fetch("/api/disengaged-users")
        .then((res) => {
          if (!res.ok) throw new Error(`API returned ${res.status}`);
          return res.json();
        })
        .then((data: DisengagedUser[]) => setDisengaged(data))
        .catch((err: unknown) =>
          setDisengagedError(
            err instanceof Error ? err.message : "Unknown error",
          ),
        )
        .finally(() => setDisengagedLoading(false));
    }
  };

  return (
    <main className="app">
      <header className="app-header">
        <h1>Selah Growth Dashboard</h1>
        <p className="subtitle">
          Internal tool for understanding user engagement.
        </p>

        <div className="tab-nav">
          <button
            className={`tab-button ${activeTab === "all" ? "active" : ""}`}
            onClick={() => handleTabChange("all")}
          >
            All Users
          </button>
          <button
            className={`tab-button ${activeTab === "disengaged" ? "active" : ""}`}
            onClick={() => handleTabChange("disengaged")}
          >
            Disengaged ({disengaged.length})
          </button>
        </div>
      </header>

      {activeTab === "all" && (
        <>
          {loading && <p className="state">Loading users...</p>}
          {error && <p className="state state--error">Error: {error}</p>}

          <section className="card-grid">
            {users.map((user) => (
              <UserCard key={user.id} user={user} />
            ))}
          </section>
        </>
      )}

      {activeTab === "disengaged" && (
        <DisengagedView
          users={disengaged}
          loading={disengagedLoading}
          error={disengagedError}
        />
      )}
    </main>
  );
}
