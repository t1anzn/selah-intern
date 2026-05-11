# Selah growth-tooling exercise

## Task 1: User card details

I expanded each user card so a growth team can understand the user at a glance without opening a detail page. The main goal was to make one card answer three main questions quickly:

1. Is this user at risk of churning?
2. Are they actively reading and replying?
3. Is there anything operational that needs attention right now?

The final card keeps the most important signal front and center: a single churn-risk pill. That pill includes a label and a number, but the number is intentionally inverted so the visual meaning stays intuitive. Lower displayed numbers mean higher risk, which makes the card easier to scan because the score, color, and wording all point in the same direction.

### What each card shows

- **Name and email**: the user’s identity and primary contact, so the card is immediately recognizable.
- **Subscription state**: shown as a badge because it is a business-status flag, not a behavior metric.
- **Paused badge**: keeps intentional pauses visible without making them look like churn.
- **Onboarding badge**: highlights users who are still early in the journey, where low activity can mean they just have not started yet.
- **Delivery issue badge**: separates email reachability problems from engagement problems, since a bounced address is a different kind of follow-up than a disengaged user.
- **Joined date**: shown only when it adds context, especially for new users or users with no activity yet.
- **Last read**: the strongest day-to-day engagement signal, because it tells the team how recently the user actually consumed content.
- **Streak**: gives a quick sense of habit strength, not just one-off activity.
- **Last reply**: shows whether the user is still responding to messages, which matters for outreach and support.
- **Notes count and most recent note**: surfaces internal context so the team can see whether anyone has already captured useful follow-up information.

### Why these fields

I chose fields that help the team decide what to do next, not just fields that are interesting to store. The card favors recency, habit, and operational flags because those are the things that change the response:

- If a user has not read recently, the team may want to re-engage them.
- If a user has a strong streak, they are probably healthy even if they have not replied lately.
- If a user is onboarding, low activity is less alarming than it is for an established user.
- If a user is bouncing, the issue is deliverability first, not churn.

That is why the card does not try to show every available metric. It uses a compact set of fields that are actionable and keep the visual hierarchy simple.

### Design choice summary

- Behavioral context appears as short supporting details.
- Operational issues stay separate from churn so they do not muddy the risk signal.
- Less important data stays out of the headline area so the card remains scannable.

This gave the dashboard a cleaner structure: the team can scan the grid for the risk pill and badges first, then read the supporting details only when they need more context.
