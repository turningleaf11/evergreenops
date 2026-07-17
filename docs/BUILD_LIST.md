# Evergreen — Build List

Running backlog for the dispo + TC operating system (OpsHQ) and the public
inventory site (`evergreen-dispo-site`). Newest ideas at the top of each section.

## Backlog

### Unified inbox + activity feed ("RSS")  — larger conversation, not started
A central place in OpsHQ to see (1) things that need action and (2) things that
just happened. Proposed shape: **one event backbone**, two views.

- Single `events` table: `type, severity, entity, actor, payload, needs_action,
  read_at, resolved_at`.
- **Feed** view: everything chronologically, filterable by severity/type.
- **Inbox** view: filter where `needs_action = true and resolved_at is null`.
- Emit a small, deliberate set of events first, then expand (curation is the
  point). Candidate first events: site-lead processing errors, 24h EMD deadline,
  campaign sent, website inquiry/offer received, GHL sync ran.
- **Decide first:** exact initial event types; Inbox per-user vs. team-wide.

## Done (recent)
- Publish-to-site toggle + `public_listings` read API.
- Public inventory site (grid, detail, gallery, financing, comps, map, manager card).
- AI marketing copy (listing description EN/ES + buyer email with {{first_name}}).
- Lead capture (`dispo_site_leads`) + write-back (`process-site-leads` → GHL + deal interest).
- Dispo manager profiles (roster + per-deal contact + photo).
- Editable site branding (colors + fonts).
