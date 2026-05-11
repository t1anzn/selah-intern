import { useEffect, useState } from 'react';
import { UserCard } from './components/UserCard';
import type { UserSummary } from './types';

export default function App() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/user-summaries')
      .then((res) => {
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        return res.json();
      })
      .then((data: UserSummary[]) => setUsers(data))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="app">
      <header className="app-header">
        <h1>Selah Growth Dashboard</h1>
        <p className="subtitle">Internal tool for understanding user engagement.</p>
      </header>

      {loading && <p className="state">Loading users...</p>}
      {error && <p className="state state--error">Error: {error}</p>}

      <section className="card-grid">
        {users.map((user) => (
          <UserCard key={user.id} user={user} />
        ))}
      </section>
    </main>
  );
}
