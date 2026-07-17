-- Move branding from raw palette swatches to semantic, per-element tokens, and
-- add a logo (image upload or wordmark text). Seeded with the "Onyx" palette:
-- Onyx #0B0F0D, Evergreen #1C9E6F, Porcelain #F2F3EF, Sea Mist #C4D8D2,
-- Live Lime #C9FF4A. Hybrid: light content, dark "frame" (nav accents, buyers
-- panel, footer), Evergreen as accent, Live Lime as a sparing signal.
alter table public.site_branding
  add column if not exists logo_type text not null default 'text',
  add column if not exists logo_text text,
  add column if not exists logo_image_url text;

update public.site_branding
set colors = jsonb_build_object(
  'page','#F2F3EF', 'card','#FFFFFF', 'ink','#0B0F0D', 'muted','#6B746F', 'line','#E3E5E0',
  'accent','#1C9E6F', 'signal','#C9FF4A',
  'heading','#0B0F0D', 'subhead','#0B0F0D',
  'btn','#1C9E6F', 'btn_text','#F2F3EF', 'btn_hover','#178A5F',
  'panel','#0B0F0D', 'panel_text','#F2F3EF', 'panel_accent','#C9FF4A',
  'inquiry','#EAF3EF', 'inquiry_heading','#0B0F0D',
  'footer','#0B0F0D', 'footer_heading','#C4D8D2', 'footer_text','#9BA5A0',
  'disclaimer','#8A928D'
),
  logo_type = 'text',
  logo_text = 'Evergreen'
where id = 1;
