# Design references — Notification Center v1

_Devi's notes from the design exploration. Links are placeholders for the real Figma._

## Panel
- Bell icon, top-right of the global nav, with a red unread-count badge.
- Click → dropdown panel, ~380px wide, anchored to the bell.
- Feed grouped by day ("Today", "Yesterday", then dates). Newest first.
- Unread rows: bolder text + a left accent dot. Read rows: muted.
- Footer action: "Mark all as read."

## States
- **Loading:** skeleton rows while the feed fetches.
- **Empty:** "You're all caught up" illustration — needed, not drawn yet.
- **Error:** if the feed fails to load — copy/behavior TODO, needs a design.
- Long feed: panel scrolls; we cap the rendered list (count TBD with Eng).

## Row anatomy
- Actor avatar · what happened · target (doc/comment) · relative timestamp.
- Whole row is a click target → deep-links to the source (the doc, the comment thread).

## Open design questions
- Badge: exact count vs "9+"? Defer to PM.
- Do we show notification *type* icons per row, or rely on the sentence? Leaning sentence-only.
- Grouping when there are dozens in one day — collapse? Not yet designed.
