# Selah growth-tooling exercise

Selah is an email-first Bible reading service. Users get one chapter a day in their inbox and reply to mark it as read (or jot down a note about what stood out). Replying is the main engagement signal. There's no app to open, no streak, no in-product activity besides email.

You'll be building a small internal dashboard that helps the growth team understand how Selah users are engaging with the product. We'll send you the sandbox separately. Run instructions are in the README.

**Submit:**

1. Your code, pushed to a public GitHub repo (link us to it).
2. A `WRITEUP.md` in the repo (keep it tight, 1-2 pages) covering:
   - The biggest trade-off you made and why
   - Where you used AI and where it slowed you down or got things wrong
   - What you'd do with another week
   - Anything you cut

Our follow-up call is **Friday 15th May at 6pm (UK time)**. Send the repo link by **Thursday 14th May at 6pm** so we have 24 hours to read the write-up. On the call you'll share your screen, run it locally and walk us through your decisions.

## The tasks

The boilerplate renders a basic card for each user. Build on it.

The seed data has ~50 synthetic users and reflects Selah's full schema as in-memory arrays. Most relevant for this exercise: users, preferences, readings (chapter assignments and read state), notes (user reflections), subscriptions, emailHistory (sent emails) and inboundEmailLog (replies received).

**Task 1, User card details.** Expand what each card shows. You decide what's useful to someone on the growth team trying to understand a user at a glance. Explain your choices in the write-up.

**Task 1.1, Scale.** In the write-up, walk us through how this dashboard would change if Selah had 5,000 users. Cover backend, frontend and database. What breaks first, what you'd change and in what order. Take a position, even if you flag where you're uncertain. We're not looking for a perfect answer. We want to see how you reason about something you may not have thought about before.

**Task 2, Surface disengaged users.** A core growth-team question is "who's drifting away?" Build a view that highlights users at risk of dropping off. **You decide what 'disengaged' means.** Days since last reply, skipped chapters, something else? Explain your reasoning in the write-up. The goal: someone on the growth team should be able to glance at this and know who to reach out to.

**Task 3, Engagement over time.** Add charts showing 7-day, 30-day and all-time engagement. **You decide what 'engaged' means** and how to express it (one chart with a toggle? three side-by-side? a stacked view?). The growth team should be able to tell at a glance whether the product is gaining or losing momentum.

## Ground rules

- Use any AI tool you'd normally use. We care about *how* you use it more than whether you do.
- Don't optimise for visual polish, optimise for clarity. The write-up is what's most important.
- If something's unclear, make a call and explain your reasoning or email to clarify.
