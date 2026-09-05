# How Autumn and Marquetta actually work together

Written 2026-09-05, after Autumn asked for the interaction to be thought
through rather than assumed.

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

## Where this happens

The channel decides whether the model works. Ranked:

1. **Through Albus.** Autumn already talks to him, he is the orchestrator, and
   he is OpenClaw-native so nothing new has to be built to reach her. The
   check-in arrives in a conversation she is already having.
2. **Email.** Reliable, async, works on a phone, easy to ignore — which is both
   the advantage and the risk.
3. **In the Content Studio.** Worst option. It requires her to remember to go
   there, which is precisely the failure that left the Studio empty for four
   months. The Studio should be where she *reviews*, never where she is
   *notified*.

Review can live in the Studio because a batch link takes her there. Notification
cannot.

---

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
