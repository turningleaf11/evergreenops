# How Autumn and Marquetta actually work together

Written 2026-09-05, after Autumn asked for the interaction to be thought
through rather than assumed.

---

## The layer above: what is any of this for

Autumn raised this and it is the real gap. Pillars, seeds, scoring and a review
queue are *balance* mechanisms. They govern how much of each kind of content
goes out. None of them says why any of it exists, who it is for, or what it is
supposed to cause.

Five levels. The engine as built covers the bottom three.

| Level | Question | Owner |
|---|---|---|
| 1. Business strategy | What does the business need — deals, capital, talent, product revenue? | Autumn |
| 2. Brand strategy | What does each brand do for that: audience, objective, desired action | Autumn |
| 3. Pillars | What mix of content serves that objective | Derived from 2 |
| 4. Seeds | Specific raw material | Marquetta + Autumn |
| 5. Drafts | The posts | Marquetta |

**Levels 1 and 2 must be data, not a document.** A strategy that lives in a
markdown file governs nothing; one that lives on `content_brands` governs seed
scoring, pillar targets and draft selection on every run. The current brand rows
carry `audience`, `voice` and `mission` — an identity, not an objective. Missing,
and needed:

| Field | Why the engine needs it |
|---|---|
| `objective` | What this brand is for. One sentence, measurable in principle |
| `primary_audience` | ONE audience, not four. "Aspiring investors, fellow operators, entrepreneurs, community followers" is four different people with four different needs, and content aimed at all of them lands on none |
| `desired_action` | What a reader should do next. Content with no intended next step is noise dressed as presence |
| `success_signal` | What would tell us it is working — DMs, saves, replies, calls booked. Not follower count |

**Seed scoring should be strategic, not cosmetic.** Today's score is
specificity: does the seed contain a number, a name, a quote. That is a proxy
for "interesting" with no strategy in it. It should be: does this serve the
objective, for the primary audience, with a plausible next step. A specific
story aimed at the wrong audience should score *below* a plainer one aimed at
the right one.

**Pillar targets should be derived, not asserted.** The current mix
(`deals_operating` 50 / `building_systems` 20 / `team_bts` 20 /
`personal_reactive` 10) was proposed by Claude and accepted as reasonable. It is
a sensible guard against AI-guru drift, but it is not yet grounded in a stated
objective. Once level 2 exists, the mix should follow from it and be revisited —
possibly unchanged, but for a reason.

### Level 2, answered — Autumn Alexander (2026-09-05)

Autumn rejected the framing of the question, and was right to. Every option
offered was a funnel: pick an objective, aim content at it. Her answer:

> First and foremost it's my personal brand so it's about me — I share my cat, I
> post meals I've made, out and about, adventuring, life stuff, cool stuff I'm
> working on. People want to do business with people they know, like and trust.

That is a real strategy, not an absence of one. It just is not a funnel.

| Field | Value |
|---|---|
| `objective` | Be known, liked and trusted as a person, so that business follows from relationship rather than from pitch |
| `primary_audience` | People who might one day do business with her — sellers, operators, partners, buyers — reached as people, not as a segment |
| `desired_action` | None per post. The action is cumulative familiarity |
| `success_signal` | People arriving already feeling they know her. Replies and DMs that sound like a conversation with someone, not a response to marketing |

### Three consequences, and the third is uncomfortable

**1. The pillar mix was wrong.** The proposed split gave life content 10%, coded
as "short, funny, in-the-moment". In a know-like-trust brand, life content is
not a garnish on business content — it is the mechanism. Revised, derived from
what she actually described rather than asserted:

| Pillar | Target | What it is |
|---|---|---|
| `life` | ~40% | The cat, the meals, out and about, adventuring. The part that makes her a person |
| `deals_operating` | ~25% | Deals, market, sellers, what is actually working |
| `building_systems` | ~20% | Cool stuff she is working on — framed as how she runs her business |
| `team_people` | ~15% | The team, the operation, the reality of it |

**2. The ad-hoc drop is the primary input, not the secondary one.** A cat photo,
a plate of food, a view from somewhere — those are captured in the moment or not
at all. No agent can produce them and no weekly question retrieves them. The
weekly check-in is now the *secondary* channel, carrying the work, deal and team
stories that would otherwise be forgotten. The drop carries the brand.

This also promotes an existing capability that had been treated as incidental:
`content-generate` already accepts an image and writes to what it sees. Photo in,
captions out, per platform, in her voice. That is the core loop for this brand.

**3. Automation itself is the risk here.** For a funnel brand, the danger is
drifting to the wrong topic. For a know-like-trust brand, the danger is *sounding
produced at all*. A feed that reads as managed destroys the exact thing it is
managing. The mechanism is that a real person is on the other end.

So Marquetta must be **less** autonomous on this brand than on the seller- and
buyer-facing ones, not more. On Autumn Alexander her job is captioning, rhythm,
memory and logistics — not authorship. She never originates a life post. She
drafts from something Autumn actually did, or she drafts nothing.

The earlier AI-guru guard still holds, but for a sharper reason than "protect the
deal funnel": an AI-guru feed and an over-produced feed fail the same way, by
stopping being a person's.

---

## The reframe: Marquetta is a producer, not a writer

The obvious model — "an AI that writes your posts" — is wrong, and it is wrong
in a way that would waste the build.

Writing is the easy part. The hard parts are: remembering that content should
happen at all, getting the raw material out of Autumn's head before it
evaporates, keeping the mix honest, and chasing the queue until something is
actually posted. That is a **producer's** job. A producer chases the talent for
material, shapes it, schedules it, and nags.

Everything below follows from that. Marquetta's value is not prose quality. It
is that content happens on weeks when Autumn is busy, which is every week.

## What she does, in four verbs

1. **Remembers.** The engine's first function is that content happens at all.
   Autumn has no posting cadence and has said so. Marquetta is the thing that
   does not forget.
2. **Extracts.** Turns a week into material by asking specific answerable
   questions. Autumn has the stories; she does not have the habit of writing
   them down.
3. **Produces.** One sentence in → platform drafts out, in the brand's voice,
   against the pillar mix.
4. **Chases.** Holds the queue, tracks the mix, reports what shipped, and says
   plainly when she is short of material.

What she explicitly does **not** do: invent facts, publish anything, decide what
is shareable about a live deal, or optimise for engagement.

## The cold-start problem

Marquetta starts with zero seeds, zero voice exemplars, zero posted history. The
deal feed was deliberately removed, and the fleet's own activity only feeds the
`building_systems` pillar — which is capped at 20%. So **the majority pillar,
`deals_operating` at 50%, has no automated source at all.**

That is not a gap to engineer around. It is the point: those stories are
Autumn's, and the check-in is how they get out. Any design that pretends
otherwise ends up fabricating, which is the one failure the whole engine is
built to avoid.

---

## The weekly loop

Total Autumn time: **about 20 minutes a week.** If it costs more, it will be
skipped, and a skipped week is a dead engine.

### 1. The check-in — Marquetta asks (5 minutes)

**Questions first, not drafts-to-react-to.** Decided 2026-09-05. While the voice
corpus is thin, reacting to weak drafts teaches her less than a well-aimed
question earns — and a bad draft costs Autumn more to fix than a one-line answer
costs to write. Once exemplars are loaded and drafting is reliably in voice, the
opening can flip to draft-first; that is a later change, driven by evidence that
the drafts are good, not by a calendar.

Once a week, Marquetta opens with what she already knows, then asks for what she
cannot see:

> This week I can see: Cash's needs-info fix shipped, the books ledger went
> live. That is `building_systems` material and you are already over on that
> pillar this month.
>
> I am short on deals and team. Four questions:
> 1. What got signed, closed, or fell apart?
> 2. What did a seller say that stuck with you?
> 3. What did someone on the team do that you would brag about?
> 4. What has someone asked you more than once lately?

Design rules for the question set, all of which matter more than the wording:

- **Never a blank prompt.** "What do you want to post about?" produces nothing.
  Every question names a category and a time window.
- **Answerable in one line.** A question that needs a paragraph gets skipped.
- **At most five.** Four is better.
- **Pillar-weighted.** Ask for what the mix is short of, not what is easy.
- **Rotating.** The same five questions every week become wallpaper by week
  three.
- **Anchored in what she can see.** Opening with real observations proves the
  check-in is not a form, and makes ignoring it feel like ignoring a colleague.

The single best question in the set is *"what has someone asked you more than
once?"* — a repeated question is content that is already proven to have an
audience, and it is exactly the signal that produced the Build Notes idea.

**Partial answers are the expected case.** Two of four is a good week. Silence
for a week is not a failure state either — see below.

### 2. The draft — Marquetta works (no Autumn time)

Each answer becomes a seed, each seed becomes drafts across the platforms that
suit it. She checks the running pillar mix before choosing what to draft, not
after.

### 3. The review — Autumn approves (10 minutes, one sitting)

A batch, not a trickle. Approve, reject with a word, or edit. The reject reason
is voice training data and is stored as such.

**This has to work on a phone in a queue at Publix.** If review requires a
laptop, review happens on Sunday night, which means it happens never. That is a
design constraint on the review UI, not a nice-to-have.

### 4. Publish and report (no Autumn time)

Approved and released → the publish worker posts it. Marquetta reads results
back.

### 5. Monthly — the honesty report (5 minutes)

> Last month: 11 posts. Mix was 55% build/systems against a 20% target, 18%
> deals against 50%. The build posts got the most response, which is exactly why
> the target exists. Do you want me to correct the mix, or change the target?

This is the anti-drift mechanism doing its job in the open. Autumn can change
the target — that is a legitimate business decision — but she has to change it
deliberately rather than have it drift.

---

## The other two ways in

**Ad-hoc drops.** Autumn thinks of something in the car and says it. It becomes
a seed immediately, no ceremony, no form. This is the highest-value input in the
whole system and it must have the least friction of anything in it. If dropping
a thought takes more than one message, it will not happen.

**Onboarding, once.** Before any of the above is worth running, Marquetta needs
20–40 real posts as voice exemplars, including a few counter-examples of what
Autumn would never say. This is a one-time hour, not a weekly cost, and drafting
quality before it is done will be mediocre no matter how good the rest is.

---

## Where this happens — decided: WhatsApp

**Marquetta lives in WhatsApp.** Decided 2026-09-05, after two earlier wrong
answers in this same document. Both are left in below, because the reasoning
that corrected them is the useful part.

**Wrong answer #1: "through Albus."** Albus's OpenClaw chat runs on Autumn's
computer, so anything delivered there can only be answered at her desk. A
weekly prompt that waits for a laptop gets answered on Sunday night, which means
never.

**Wrong answer #2: "her own Discord channel."** Discord is on her phone and
delivery *out* is easy, so it looked cheap. But installing an agent into Discord
means the developer portal — unfamiliar work, landing on Autumn, who has said
plainly that she needs the developer to be the developer. The cost was
mis-assigned: Discord's setup falls on her, WhatsApp's falls on Claude, and
the second is the correct place for it.

**The deciding fact is a habit that already exists.** Autumn already uses
WhatsApp's message-to-self as a dump for reminders and things worth keeping.
Every other channel in this design is an attempt to manufacture a habit;
this one is already hers. Designing for a behaviour that exists beats designing
for one we hope to create, and the ad-hoc drop — now the *primary* input for the
personal brand — lives or dies on exactly that.

Photos also belong to WhatsApp. The core loop for a know-like-trust brand is a
picture taken in the moment, and sharing to WhatsApp from a camera roll is one
tap and already muscle memory.

### What this costs, honestly

Not free, and not all of it is Claude's to absorb:

- WhatsApp Cloud API needs a Meta app and a WhatsApp Business Account. Autumn
  already has Meta Business set up (FB business Page, IG Business/Creator), so
  this happens in accounts she already uses rather than a portal she does not.
- It needs a **separate phone number** — Marquetta cannot be reached on Autumn's
  personal WhatsApp number. In practice Autumn messages "Marquetta" as a
  contact instead of messaging herself. Arguably better: it is a real thread
  with an agent, not a note in a drawer.
- Business verification can take days. Meta's test-number path unblocks
  development in the meantime.
- Twilio's WhatsApp API is the faster route to a working prototype (sandbox in
  minutes) at the cost of a per-message fee. Worth using to prove the loop before
  committing to Cloud API setup.

Claude does the integration. Autumn's part is a short, specific list of clicks,
produced once the exact requirements are confirmed — not a research task handed
to her.

### Build it as a generic inbox, not a Marquetta feature

Autumn separately raised wanting **one place to dump everything**, with a triage
agent that sorts it and routes each item to the right agent. That is a separate
build and is deliberately out of scope here — but it shares this exact channel
and this exact input.

So the WhatsApp intake must be built **generic from the start**: inbound
messages land in a table with sender, text, media and timestamp, then get
classified and routed. v1 registers exactly one route — content seeds to
Marquetta. The triage agent later adds routes without touching the intake.

Building a Marquetta-specific WhatsApp integration would mean tearing it out to
build the inbox, and would leave Autumn with two competing dump channels in the
meantime — which defeats the point of a single dump.

### Review has to work on the phone too

The check-in reaching her phone is only half of it. If approving drafts requires
a laptop, review becomes the new bottleneck and the queue silts up.

**v1:** the review batch posts to her Discord channel with a link into the
Content Studio review queue, and **that queue must be genuinely usable on a
phone** — batch approve/reject, one thumb, no horizontal scrolling. That is a
build requirement on the review UI, not a nice-to-have.

**Later, if review still feels heavy:** approve and reject by Discord reaction
(✅ / ❌) directly on the draft message. That is the lowest-friction review that
exists, but it needs a bot listening for reaction events, which is a real
integration rather than existing plumbing. Worth doing only once the loop is
proven and the friction is measured rather than assumed.

Voice-note replies are the same category — Discord supports them, but they need
transcription wired up. Nice, not first.

## When Autumn does not answer

The engine must degrade honestly, and this is the part most content tools get
wrong.

- **Draft from what exists.** Fleet activity and research still produce
  `building_systems` material.
- **Say what is missing.** "Two drafts this week, both build. No deal or team
  material since the 12th — that mix is drifting."
- **Never fabricate to fill the gap.** No invented deals, no invented numbers,
  no generic listicle to hit a quota.
- **A quiet week is a legitimate output.** "Nothing worth posting from this
  week" is an acceptable and sometimes correct result. An engine that always
  produces something will eventually produce filler, and filler is what turns a
  practitioner's feed into a guru's.
- **Escalate on a pattern, not an instance.** One missed check-in is a busy
  week. Three in a row is worth saying out loud.

---

## What would make this fail

Named so they can be watched for:

- **Review debt.** Drafts accumulate faster than they are released. If the queue
  is growing, the cadence is too high — lower it. An engine producing twenty
  drafts a week that nobody releases is the same as no engine.
- **Check-in fatigue.** The questions stop feeling like a colleague and start
  feeling like a form. Rotation and real observations are the defence.
- **Voice drift by acceptance.** Autumn approves drafts that are *fine* rather
  than *hers*, and the corpus slowly averages out. Counter-examples in the
  exemplar set are the defence.
- **Silent pillar drift.** Covered by the monthly report, which is why the
  report is a required output and not a dashboard she has to visit.
