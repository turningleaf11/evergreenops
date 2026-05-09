-- Preflight for the core workspace repair migration.
-- Some production tables may already exist without the unique keys used by ON CONFLICT.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'OpsHQ',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.workspaces (name, description)
SELECT 'OpsHQ', 'EvergreenOps workspace'
WHERE NOT EXISTS (SELECT 1 FROM public.workspaces);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Keep the newest profile row for each auth user before adding a unique index.
DELETE FROM public.profiles p
USING public.profiles duplicate
WHERE p.user_id IS NOT NULL
  AND duplicate.user_id = p.user_id
  AND duplicate.ctid > p.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id_unique ON public.profiles(user_id);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  is_primary BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'user';
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

-- Keep one role row per user/role, preferring primary/admin rows if present.
WITH ranked AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY user_id, role
      ORDER BY is_primary DESC, ctid DESC
    ) AS rn
  FROM public.user_roles
  WHERE user_id IS NOT NULL
)
DELETE FROM public.user_roles r
USING ranked
WHERE r.ctid = ranked.ctid
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_user_role_unique ON public.user_roles(user_id, role);

CREATE TABLE IF NOT EXISTS public.addon_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT,
  name TEXT NOT NULL DEFAULT 'Add-on',
  description TEXT,
  icon TEXT,
  price_tier TEXT NOT NULL DEFAULT 'free',
  stripe_price_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.addon_packs ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.addon_packs ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Add-on';
ALTER TABLE public.addon_packs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.addon_packs ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.addon_packs ADD COLUMN IF NOT EXISTS price_tier TEXT NOT NULL DEFAULT 'free';
ALTER TABLE public.addon_packs ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
ALTER TABLE public.addon_packs ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.addon_packs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.addon_packs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

WITH ranked AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY slug
      ORDER BY is_active DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, ctid DESC
    ) AS rn
  FROM public.addon_packs
  WHERE slug IS NOT NULL
)
DELETE FROM public.addon_packs a
USING ranked
WHERE a.ctid = ranked.ctid
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_addon_packs_slug_unique ON public.addon_packs(slug);

CREATE TABLE IF NOT EXISTS public.workspace_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES public.addon_packs(id) ON DELETE CASCADE,
  enabled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_addons ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.workspace_addons ADD COLUMN IF NOT EXISTS addon_id UUID REFERENCES public.addon_packs(id) ON DELETE CASCADE;
ALTER TABLE public.workspace_addons ADD COLUMN IF NOT EXISTS enabled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.workspace_addons ADD COLUMN IF NOT EXISTS enabled_at TIMESTAMPTZ NOT NULL DEFAULT now();

WITH ranked AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY workspace_id, addon_id
      ORDER BY enabled_at DESC NULLS LAST, ctid DESC
    ) AS rn
  FROM public.workspace_addons
  WHERE workspace_id IS NOT NULL AND addon_id IS NOT NULL
)
DELETE FROM public.workspace_addons wa
USING ranked
WHERE wa.ctid = ranked.ctid
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_addons_workspace_addon_unique
ON public.workspace_addons(workspace_id, addon_id);

NOTIFY pgrst, 'reload schema';
