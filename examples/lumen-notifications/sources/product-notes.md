# Product notes — Notification Center

_Priya's working doc. Rough, not the PRD._

## Why now
- In-app notifications are the #1 power-user request (see CS ticket tags `notif-*`, ~120 last quarter).
- Email-only means everything is async + delayed. Mentions, comments, share events all suffer.

## v1 scope (draft)
- Bell icon in the top nav with an unread count badge.
- Dropdown feed: most recent first, grouped by day.
- Notification types at launch: **@-mentions**, **comment replies**, **doc shares**.
- "Mark all as read." Per-item read-on-click.
- Realtime delivery (live badge update, no refresh).
- Minimal preferences: a global notifications on/off toggle in Settings.

## Out of scope for v1
- Per-type mute / granular preferences.
- Mobile push.
- Digest emails / batching.
- Notification *preferences* settings page — deferred to v2.

## Open
- Retention window for the feed (how far back?). TBD.
- Do in-app notifications suppress the matching email, or do both fire? Leaning "both" but unresolved.
- Badge count: cap at "9+" or show exact number?

## Target
- Reduce "missed @-mention" support tickets by 50% within one quarter of launch.
