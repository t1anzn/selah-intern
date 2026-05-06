# Selah Intern Sandbox Web

React + TypeScript + Vite frontend for the growth-tooling exercise.

## Run

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

The API needs to be running at `http://localhost:4000` (start it from `../api`
with `npm run dev`). Vite proxies `/api/*` requests through, so fetch calls
in components can use the relative path: `fetch('/api/users')`.

## What's here

- `src/App.tsx` — root component, fetches `/api/users` and renders cards
- `src/components/UserCard.tsx` — single user card (name + email only)
- `src/types.ts` — minimal `User` type. Extend as you add fields to the card.
- `src/index.css` — minimal styling. Replace, extend or rip out as you like.

## Tasks

See `EXERCISE.md` for what to build.
