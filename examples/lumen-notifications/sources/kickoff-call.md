# Kickoff call — Lumen Notification Center v1

**Date:** 2026-06-02
**Attendees:** Priya (PM), Marcus (Eng lead), Devi (Design), Tom (Customer Success)

---

**[00:01:30] Priya:** Quick framing. Lumen has email notifications today and that's it. Power
users keep asking for an in-app notification center — a bell icon, a feed, the works. CS is
fielding the same "I missed the comment on my doc" ticket every week. This quarter we build v1.

**[00:03:10] Tom:** From the support side, the number one complaint is missed @-mentions. People
get the email a day later, the thread's moved on. If they had a live in-app feed they'd catch it.

**[00:05:42] Priya:** So the headline goal: cut "missed mention" tickets in half within a quarter
of launch. That's the success metric I'm committing to leadership.

**[00:08:15] Marcus:** Realtime is the hard part. A bell that updates live means websockets or
polling. We can do it but I want to flag it's the bulk of the effort.

**[00:09:50] Priya:** Realtime is non-negotiable for launch. The whole point is "live." If it's a
page-refresh feed we haven't solved Tom's problem.

**[00:14:20] Devi:** On the design side I'm picturing a dropdown panel off the bell — grouped by
day, unread in bold, a "mark all read" action. I'll need decline/empty states too.

**[00:17:05] Marcus:** One thing — notification *preferences*. Can users mute certain types? That's
a whole settings surface. I'd push it out of v1 personally.

**[00:18:40] Priya:** Let's keep preferences in scope but minimal — at least a global on/off toggle.
We can't ship something users can't turn down.

**[00:24:10] Tom:** Will this replace the emails or run alongside them?

**[00:24:45] Priya:** Alongside for now. In-app is additive. … Actually, we should revisit — double
-notifying people might annoy them. Park it.

**[00:31:00] Marcus:** Retention question: how long do we keep notifications in the feed? Forever?

**[00:31:30] Priya:** Good question, don't have a number. Some reasonable window. Let's nail it down
later.

**[00:38:00] Priya:** Okay — Devi on flows, Marcus scoping the realtime transport, I'll write up
the PRD. Reconvene Thursday.
