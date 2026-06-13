# Design References — Checkout Revamp (v1 mocks)

_Dani — dropping the Figma links here so they're in the repo. These are reference-only; the actual
frames live in Figma. First pass covers the happy path we agreed on._

**Figma file:** `https://figma.com/file/FKFL-checkout-revamp` (reference only)

## Frames in this pass

| Frame | Link (ref) | Notes |
|---|---|---|
| Cart summary | `…/FKFL-checkout-revamp?node=12:001` | Items, subtotal, delivery ETA, edit qty |
| Delivery address | `…/FKFL-checkout-revamp?node=12:014` | Prefilled vs manual; map pin preview |
| Payment — wallets | `…/FKFL-checkout-revamp?node=12:030` | Apple Pay / Google Pay buttons up top |
| Payment — card form | `…/FKFL-checkout-revamp?node=12:031` | Manual card entry, fallback below wallets |
| Place order (CTA state) | `…/FKFL-checkout-revamp?node=12:045` | Loading / spinner on submit |

## Notes
- All frames are mobile-first (375px); desktop is a stretch goal for this pass.
- Using the existing design-system sheet modal for the payment step.
- Empty-cart state already exists in the current app, reusing it.

_Not yet mocked: still working through the back half of the flow. Will add frames as they're ready._
