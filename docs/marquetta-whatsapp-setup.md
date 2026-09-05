# Marquetta on WhatsApp — what Autumn has to do

Everything else is built. This is the part that needs a person, because it
involves accounts and a phone number. It is a list of specific things to click,
not a research task — if any step turns out to be more than a click, that is a
bug in this page and it should be fixed rather than worked around.

**Time:** about 20 minutes for the Twilio path, longer for Meta only because
business verification takes days on their side, not yours.

---

## First, one decision

| | Twilio | Meta Cloud API |
|---|---|---|
| Working in | ~20 minutes (sandbox) | days (business verification) |
| Cost | a fraction of a cent per message | free |
| Phone number | Twilio provides one | you supply one |
| Best for | proving the loop works | running it for good |

**Recommendation: start on Twilio, move to Meta later.** The code supports both
and switching is a config change, not a rewrite. The point of the first two
weeks is finding out whether you actually drop things into a thread — that is a
question about you, not about infrastructure, and it should be answered in
twenty minutes rather than after a week of verification.

---

## Path A — Twilio (recommended first)

1. Create a Twilio account. Free trial credit covers this comfortably.
2. Console → **Messaging → Try it out → Send a WhatsApp message**. This opens
   the sandbox and shows a number plus a join code like `join <two-words>`.
3. From your own WhatsApp, message that number with the join code. That links
   your phone to the sandbox.
4. Copy your **Account SID** and **Auth Token** from the Console dashboard.
5. Send them to Claude. They go into Supabase secrets, never into the repo.
6. Claude sets the webhook URL in the sandbox settings, adds your number to the
   sender allowlist, and tells you when it is live.

Sandbox caveat, so it is not a surprise: the link expires every 72 hours and you
re-send the join code. Fine for testing, not for real use — which is what Path B
is for.

## Path B — Meta Cloud API (production)

1. **developers.facebook.com** → your app (or create one) → add the **WhatsApp**
   product.
2. You need a phone number that is **not** the one on your personal WhatsApp. A
   number can only be on one WhatsApp account. Options: a second SIM, a Google
   Voice number, or a cheap prepaid — anything that can receive one SMS to
   verify.
3. WhatsApp → API Setup → add and verify that number.
4. Copy the **App Secret** (Settings → Basic) and generate a permanent access
   token.
5. Send both to Claude, plus the number.
6. Claude configures the webhook and the verify token; you click **Verify and
   Save** in the Meta console once, and subscribe to the `messages` field.

Business verification may sit pending for a few days. Meta gives you a test
number in the meantime, which is enough to keep building.

---

## What Autumn ends up with

A WhatsApp contact called Marquetta. Sending her a photo, a voice note or a line
of text drops it straight into the content engine as a seed. It is not the
message-to-self chat — it is a thread with an agent, which is better: the
conversation has a record and she gets a reply.

## What Claude does with what is handed over

- Credentials go into Supabase function secrets. Never in the repo, never in a
  migration, never in a skill file, never in a log.
- The webhook URL is registered with the provider.
- Autumn's number is added to `inbound_senders`.
- A test message is sent end to end, and the seed it creates is confirmed in
  `content_seeds` before this is called done.

## Why the allowlist exists

The webhook is a public URL. Signature verification proves a message came from
Meta or Twilio; it proves nothing about who sent it. Without an allowlist,
anyone who learned the number could plant content that later surfaces in the
review queue wearing Autumn's voice — and it would be approved in a batch on a
phone, which is exactly when nobody is looking closely.

So only allowlisted numbers route. Everything else is recorded and ignored:
recorded because "I sent it and nothing happened" needs an answer, ignored
because a message worth seeing once is not a message worth acting on.

## Known gap at the time of writing

Media arrives as a **reference**, not as bytes. Downloading the actual photo
needs a second authenticated call to the provider and a storage bucket. The
photo is the core loop for the personal brand, so that is the next piece of
work — captions cannot be written about an image nobody fetched.
