-- Gallery of property photos for a deal's Prep (hero = photos[0]). Stored in the
-- public dispo-property-photos bucket; this column holds the URLs.
alter table public.dispo_deal_details add column if not exists photos text[] default '{}';
