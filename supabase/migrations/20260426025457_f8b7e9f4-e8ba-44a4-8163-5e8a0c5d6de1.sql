ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS contact_type text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS preferred_contact_method text,
  ADD COLUMN IF NOT EXISTS buy_box_notes text,
  ADD COLUMN IF NOT EXISTS markets text[],
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_contact_type_check;
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_contact_type_check
  CHECK (contact_type IN ('wholesaler','broker','buyer','title_agent','attorney','lender','contractor','investor','other'));

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_preferred_contact_method_check;
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_preferred_contact_method_check
  CHECK (preferred_contact_method IS NULL OR preferred_contact_method IN ('email','phone','text'));

CREATE INDEX IF NOT EXISTS idx_contacts_contact_type ON public.contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_contacts_is_active ON public.contacts(is_active);