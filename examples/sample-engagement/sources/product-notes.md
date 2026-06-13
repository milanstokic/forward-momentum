# Forkful Checkout Revamp — Working Notes

_Priya, jotted after the kickoff + a follow-up with the data team. Rough, not a spec yet._

## Why we're doing this
- Cart → order-placed drop-off is ~31%. Target: under 20% this release.
- Most of the pain is concentrated at the payment step (per support tickets + the funnel data).

## Scope for this release
- New single-page checkout: cart summary → delivery address → payment → place order.
- Reduce steps. Today there are four screens; aim for one.
- Payment: add Apple Pay and Google Pay alongside the existing card form.

## Decisions / constraints
- We're standardizing on accounts for fraud + loyalty reasons. **Every order must be tied to a
  Forkful account** — the data team needs a stable user id on each order for the loyalty-points
  ledger and chargeback handling, so the checkout will require the user to be signed in before
  placing an order. New users get a lightweight signup folded into the address step.
- Address: prefill from the signed-in profile where we have it; otherwise manual entry.
- Delivery ETA shown on the cart summary, recalculated when the address changes.

## Payments
- Add the wallets (Apple Pay, Google Pay). Keep the card form.
- Wallets should be the primary, most-prominent option on mobile.

## Loyalty
- Points accrue on every completed order — 1 point per dollar. Surface the points earned somewhere
  after the order completes.

## Open / parked
- Saved cards — how they behave, where they show. (Parked from kickoff.)
- Cart recovery / abandoned-cart email — explicitly parked, not this release.

## Misc
- Marketing runs "first order 20% off" promos; the new flow needs to not break those.
- Reuse the existing design-system components where possible (buttons, inputs, sheet modals).
