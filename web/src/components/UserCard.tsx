import type { User } from '../types';

type Props = {
  user: User;
};

export function UserCard({ user }: Props) {
  return (
    <article className="user-card">
      <h2 className="user-card__name">{user.name ?? 'Unnamed user'}</h2>
      <p className="user-card__email">{user.email}</p>
    </article>
  );
}
