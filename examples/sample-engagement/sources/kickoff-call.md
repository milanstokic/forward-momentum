# Kickoff Call — Forkful Checkout Revamp

**Date:** 2026-05-04
**Attendees:** Priya (Product, Forkful), Marcus (Eng lead, Forkful), Dani (Design), Tom (Client stakeholder — Forkful VP of Growth)
**Recording:** internal-only, auto-transcribed (lightly cleaned)

---

**Priya:** Okay, thanks everyone for jumping on. So the headline is: checkout conversion is bleeding. We're at something like a 31% drop-off between "add to cart" and "order placed." Tom's been living this number for a quarter.

**Tom:** Yeah. The board is asking why we're losing a third of the orders at the literal finish line. My read from support tickets is that people get to the payment step, hit some friction, and just bounce. So this revamp is the priority for Q3.

**Priya:** Right. So the goal we're aligning on today: rebuild the checkout flow to reduce that drop-off. The number we floated was getting it from 31% down to under 20%.

**Marcus:** That's a big swing but okay, I'll buy under-20 as the target. What's actually changing though? Drop-off has a lot of causes.

**Tom:** The biggest one, from talking to users — they hate being forced to make an account before they can pay. Like, I just want a burrito, I don't want a relationship. So guest checkout. That's the number one ask. Let people pay without signing up.

**Priya:** Agreed, guest checkout is a must-have. If you have an item in your cart you should be able to get to "order placed" without ever creating an account.

**Dani:** That changes the whole flow shape. Right now the account screen is step one. So we'd collapse it — cart, then straight to a single payment screen?

**Priya:** Ideally one screen. Cart summary, delivery address, payment, place order. The fewer steps the better.

**Marcus:** On payment — what are we supporting? Right now it's just card entry, the manual form.

**Tom:** We need the wallets. Apple Pay, Google Pay. That's table stakes now, half our traffic is mobile and they expect to just thumbprint and go.

**Marcus:** Sure. So Apple Pay, Google Pay, and the existing card form. Do we keep saved cards for logged-in users, or—

**Priya:** Let's — yeah, let's come back to the saved cards thing, I want to think about how that interacts with guest. Dani, can you note that as open.

**Dani:** Noted.

**Tom:** Oh and one thing the support team keeps flagging — when a card gets declined right now, the user just sees the form again with no message. They retry the same card three times and rage-quit. Whatever we build, that has to feel less broken.

**Priya:** Good, yeah. So after they place the order, they land on a confirmation screen — order number, estimated delivery time, "we're on it." That moment matters, it's the payoff.

**Dani:** Love that. I'll mock the happy path first — cart, payment, confirmation.

**Marcus:** What about people who add stuff to cart and leave? We do anything to bring them back, or is that out of scope?

**Tom:** I mean, ideally we don't lose the cart. But let's not boil the ocean. Focus on the checkout itself.

**Priya:** Yeah let's keep the cart-recovery stuff parked, this release is the checkout flow. Dani, can you have first mocks by end of next week?

**Dani:** Should be doable for the happy path. I'll share a Figma link in the channel.

**Tom:** One more — marketing's going to want promo codes to work in the new flow, they run a lot of "first order 20% off" campaigns. Just flagging it.

**Priya:** Noted, we'll fold that in. Okay — I'll write up notes and we sync Thursday.

**Marcus:** Sounds good.

**Dani:** 👍
