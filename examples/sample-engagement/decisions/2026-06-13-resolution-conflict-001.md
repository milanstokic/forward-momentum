# Resolution Record: conflict-001 — account model

| Field      | Value |
|------------|-------|
| Gate       | Resolution |
| Issue      | conflict-001 (blocking conflict) |
| Status     | resolved |
| Decided At | 2026-06-13T00:00:00.000Z |
| Decided By | Product |

## The conflict

The kickoff call committed to **guest checkout** — reaching "order placed" without ever creating an
account — while the product notes require **every order to be tied to a signed-in Forkful account**.
Both cannot ship as stated.

- Source A (kickoff-call.md L17, L19): "Let people pay without signing up." / "guest checkout is a
  must-have. If you have an item in your cart you should be able to get to 'order placed' without
  ever creating an account."
- Source B (product-notes.md L15-L18): "Every order must be tied to a Forkful account ... the
  checkout will require the user to be signed in before placing an order."

## Decision

**Accounts are required for every order, but signup is reduced to a lightweight, inline step folded
into the checkout flow** — there is no separate signup wall before checkout. The data team's stable
user-id requirement (loyalty-points ledger, chargeback handling, fraud) is load-bearing and wins on
correctness; the call's intent (no friction, no separate signup screen) is preserved by folding a
minimal signup into the address step rather than a blocking account-creation gate.

Net effect for the PRD:
- Every order carries an `accountId`. (honors Source B / claim-009)
- The user never hits a standalone "create an account" wall; signup is inline in the address step.
  (honors the spirit of Source A / claim-004 — low friction — without literal anonymous orders)

## Rationale

The stable user-id is a hard data-integrity requirement (ledger + chargebacks). Literal anonymous
guest orders would break it. The friction concern that motivated guest checkout is addressed by
making signup invisible/inline rather than by dropping accounts. This is a deliberate, recorded
trade-off — the receipt that the team chose Source B's correctness over Source A's literal wording.
