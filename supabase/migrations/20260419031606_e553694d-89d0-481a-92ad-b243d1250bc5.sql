-- 1. content_brands
CREATE TABLE public.content_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0F6E56',
  audience TEXT NOT NULL DEFAULT '',
  voice TEXT NOT NULL DEFAULT '',
  mission TEXT NOT NULL DEFAULT '',
  seeds JSONB NOT NULL DEFAULT '[]'::jsonb,
  canva_kit_id TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own brands"
  ON public.content_brands FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all brands"
  ON public.content_brands FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_content_brands_updated
  BEFORE UPDATE ON public.content_brands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. content_library
CREATE TABLE public.content_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID,
  brand_id UUID REFERENCES public.content_brands(id) ON DELETE SET NULL,
  brand_name TEXT NOT NULL,
  brand_color TEXT NOT NULL DEFAULT '#0F6E56',
  platform TEXT NOT NULL,
  platform_label TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  seed TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  canva_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own library"
  ON public.content_library FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all library"
  ON public.content_library FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_content_library_updated
  BEFORE UPDATE ON public.content_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_content_library_user_status ON public.content_library(user_id, status);
CREATE INDEX idx_content_brands_user ON public.content_brands(user_id, sort_order);

-- 3. Seed add-on pack
INSERT INTO public.addon_packs (slug, name, description, icon, price_tier, is_active)
VALUES (
  'content_studio',
  'Content Studio',
  'AI-powered multi-brand content generator. Upload an image or seed, generate captions for Facebook, Instagram, TikTok, LinkedIn and blog outlines. Save to a personal library with status workflow.',
  'Sparkles',
  'paid',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  is_active = true;