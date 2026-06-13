# ANSWER KEY — Planted Issues (Test Oracle)

> **This file is the oracle for the T5 gap-analysis golden test.** The golden test asserts that the
> `/fm-gaps` agent, run over `sources/`, surfaces every issue listed here (and the one conflict).
> **It MUST stay in sync with `sources/`** — if you edit a source file, re-verify the `where` quotes
> below still match verbatim, and update ids/quotes accordingly. Adding or removing a planted issue
> here without changing `sources/` (or vice versa) will silently weaken or break the golden test.

The planted issues are hidden in natural conversation and notes — none are flagged as "TODO" or
"open question" in a way that makes them trivial to find. A reader skimming the sources should
plausibly miss them; the gap-analysis agent's job is to catch them.

**Summary:** 6 planted issues — 5 gaps (3 requirement, 2 design) + 1 conflict.

---

## Issues

### gap-01
- **type:** gap
- **category:** requirement
- **severity:** blocking
- **where:** `sources/kickoff-call.md` — Priya: _"Let's — yeah, let's come back to the saved cards thing, I want to think about how that interacts with guest."_ and `sources/product-notes.md` — _"Saved cards — how they behave, where they show. (Parked from kickoff.)"_
- **why:** Saved-card behavior is explicitly parked and never resolved, yet guest checkout + wallets ship in the same release — whether/how saved cards work (and their interaction with guest checkout) is left undefined, which is a payment-correctness requirement that must be settled before build.

### gap-02
- **type:** gap
- **category:** design
- **severity:** blocking
- **where:** `sources/kickoff-call.md` — Tom: _"when a card gets declined right now, the user just sees the form again with no message... Whatever we build, that has to feel less broken."_ ; the declined/error state is **absent** from `sources/design-references.md` (no error-state frame is listed).
- **why:** A failed/declined-payment error state is called out as a known pain point in the call but no error-state frame exists in the design references — a missing design that later becomes a GitHub design task.

### gap-03
- **type:** gap
- **category:** design
- **severity:** non-blocking
- **where:** `sources/kickoff-call.md` — Priya: _"after they place the order, they land on a confirmation screen — order number, estimated delivery time, 'we're on it.'"_ ; the confirmation screen is **not listed** in the `sources/design-references.md` frame table (which stops at "Place order (CTA state)").
- **why:** The order-confirmation screen is explicitly described in the call as "the payoff," but no confirmation frame appears in the designs and it is absent from the product notes — a design gap (post-checkout screen unmocked).

### gap-04
- **type:** gap
- **category:** requirement
- **severity:** non-blocking
- **where:** `sources/kickoff-call.md` — Tom: _"marketing's going to want promo codes to work in the new flow"_ → Priya: _"Noted, we'll fold that in."_ ; `sources/product-notes.md` — _"the new flow needs to not break those."_
- **why:** Promo/discount code handling is acknowledged but never specified — no requirement for where a code is entered, validation, stacking, or how it affects the displayed total.

### gap-05
- **type:** gap
- **category:** requirement
- **severity:** non-blocking
- **where:** `sources/kickoff-call.md` — Marcus: _"What about people who add stuff to cart and leave?"_ → Tom: _"ideally we don't lose the cart. But let's not boil the ocean."_ → Priya: _"let's keep the cart-recovery stuff parked."_ ; `sources/product-notes.md` — _"Cart recovery / abandoned-cart email — explicitly parked, not this release."_
- **why:** Cart persistence/recovery is parked, but the in-session behavior of the cart (does the cart survive a refresh or a navigation away mid-checkout?) is left undefined for a flow that is now single-page — distinct from the parked abandoned-cart email.

### conflict-01
- **type:** conflict
- **category:** requirement
- **severity:** blocking
- **where:**
  - **Source A** `sources/kickoff-call.md` — Priya: _"Agreed, guest checkout is a must-have. If you have an item in your cart you should be able to get to 'order placed' without ever creating an account."_ (echoed by Tom: _"Let people pay without signing up."_)
  - **Source B** `sources/product-notes.md` — _"Every order must be tied to a Forkful account ... the checkout will require the user to be signed in before placing an order."_
- **why:** Direct contradiction — the kickoff call commits to guest checkout (order placed with no account), while the product notes require every order to be tied to a signed-in account. Both cannot be true; this is the central blocking conflict the Resolution gate must force a decision on.

---

## Quick reference table

| id | type | category | severity | one-line |
|---|---|---|---|---|
| gap-01 | gap | requirement | blocking | Saved-card behavior parked + undefined vs guest checkout/wallets |
| gap-02 | gap | design | blocking | No error/declined-payment state in the designs, despite being a named pain point |
| gap-03 | gap | design | non-blocking | Order confirmation screen described in call but missing from designs/notes |
| gap-04 | gap | requirement | non-blocking | Promo/discount code handling acknowledged but never specified |
| gap-05 | gap | requirement | non-blocking | In-session cart persistence undefined for the new single-page flow |
| conflict-01 | conflict | requirement | blocking | Guest checkout (call) vs login-required-for-all-orders (notes) |

**Counts:** gaps = 5 (requirement = 3, design = 2); conflicts = 1. Blocking = 3 (gap-01, gap-02, conflict-01).
