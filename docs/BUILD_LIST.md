# Evergreen — Build List

Running backlog for the dispo + TC operating system (OpsHQ) and the public
inventory site (`evergreen-dispo-site`). Newest ideas at the top of each section.

## Backlog

### Unified inbox + activity feed — extensions
v1 shipped (events backbone + /activity Inbox/Feed). Next:
- **24h EMD-deadline pings** — needs a scheduled/cron check to emit.
- **Per-user assignment/routing** — v1 is team-wide; add ownership + "assigned to me".
- **Deep-link Activity rows** to the specific deal (currently routes to /crm/deals).
- **Fold the Gmail inbox** (/inbox) into one unified inbox eventually.

## In progress — TC (transaction coordination) batch
The "get it closed" half. Model: TC branch is disposition-to-buyer vs we-are-buyer
(portfolio, later); assignment vs double-close is a minor variant (double = 2 HUDs).
See memory `evergreen-tc-close-process`.

- [x] **Deal documents + AI date extraction** — upload PA/assignment/HUDs/EMD/POF/
      title (private bucket); Claude extracts key dates → review → apply to deal.
- [x] **Scheduled jobs** — pg_cron enabled; `run_deadline_checks()` runs weekday
      mornings (business_holidays + weekend aware).
- [x] **Deadline engine** — live countdowns on Closing (EMD due, DD end, closing,
      buyer-EMD 24h business-day clock) + nightly pings into the Activity inbox
      (deduped by deal/deadline/bucket).
- [~] **Assignment tracking** — signed date + buyer-EMD received captured (drives
      the clock). Full package-sent tracking still open.
- [ ] **Close → GHL writeback** — on Closed-Won, push outcome to the GHL
      opportunity so KPI dashboards update. (Next.)

## Done (recent)
- Unified inbox + activity feed v1: `events` backbone, `/activity` (Inbox = needs
  action, Feed = all), live nav badge + realtime, emitters (site inquiry, buyers
  signup, lead error, campaign sent, deal published), public `event-ingest`
  webhook for Zapier zap failures.
- Publish-to-site toggle + `public_listings` read API.
- Public inventory site (grid, detail, gallery, financing, comps, map, manager card).
- AI marketing copy (listing description EN/ES + buyer email with {{first_name}}).
- Lead capture (`dispo_site_leads`) + write-back (`process-site-leads` → GHL + deal interest).
- Dispo manager profiles (roster + per-deal contact + photo).
- Editable site branding (colors + fonts).
