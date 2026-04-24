-- Mirror email_links into crm_activities so emails appear in contact/deal timelines
CREATE OR REPLACE FUNCTION public.crm_mirror_email_link()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entity_type IN ('contact','company','deal') THEN
    INSERT INTO public.crm_activities (
      workspace_id, entity_type, entity_id, type, subject, body, actor_id, metadata, occurred_at
    ) VALUES (
      NEW.workspace_id,
      NEW.entity_type,
      NEW.entity_id,
      'email',
      COALESCE(NULLIF(NEW.subject, ''), '(no subject)'),
      COALESCE(NEW.snippet, ''),
      NEW.linked_by,
      jsonb_build_object(
        'gmail_thread_id', NEW.gmail_thread_id,
        'gmail_message_id', NEW.gmail_message_id,
        'email_link_id', NEW.id
      ),
      NEW.created_at
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_email_link_mirror ON public.email_links;
CREATE TRIGGER trg_email_link_mirror
AFTER INSERT ON public.email_links
FOR EACH ROW EXECUTE FUNCTION public.crm_mirror_email_link();

-- Also clean up activity when an email link is removed
CREATE OR REPLACE FUNCTION public.crm_cleanup_email_link()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.crm_activities
   WHERE type = 'email'
     AND (metadata->>'email_link_id')::uuid = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_email_link_cleanup ON public.email_links;
CREATE TRIGGER trg_email_link_cleanup
AFTER DELETE ON public.email_links
FOR EACH ROW EXECUTE FUNCTION public.crm_cleanup_email_link();

-- Backfill any existing email_links that don't yet have a mirrored activity
INSERT INTO public.crm_activities (workspace_id, entity_type, entity_id, type, subject, body, actor_id, metadata, occurred_at)
SELECT el.workspace_id, el.entity_type, el.entity_id, 'email',
       COALESCE(NULLIF(el.subject,''), '(no subject)'),
       COALESCE(el.snippet,''),
       el.linked_by,
       jsonb_build_object('gmail_thread_id', el.gmail_thread_id, 'gmail_message_id', el.gmail_message_id, 'email_link_id', el.id),
       el.created_at
  FROM public.email_links el
 WHERE el.entity_type IN ('contact','company','deal')
   AND NOT EXISTS (
     SELECT 1 FROM public.crm_activities a
      WHERE a.type = 'email' AND (a.metadata->>'email_link_id')::uuid = el.id
   );

-- Suggest contacts/deals for a Gmail thread by matching participant emails
CREATE OR REPLACE FUNCTION public.crm_suggest_links_for_emails(_emails text[])
RETURNS TABLE (
  entity_type text,
  entity_id uuid,
  display_name text,
  matched_email text,
  secondary text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH ws AS (SELECT public.get_user_workspace_id() AS id),
       norm AS (SELECT DISTINCT lower(trim(e)) AS email FROM unnest(_emails) e WHERE e IS NOT NULL AND e <> '')
  SELECT 'contact'::text,
         c.id,
         trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')),
         c.email,
         c.title
    FROM public.contacts c
    JOIN norm n ON lower(c.email) = n.email
   WHERE c.workspace_id = (SELECT id FROM ws)
   UNION ALL
  SELECT 'deal'::text,
         d.id,
         d.title,
         c.email,
         d.status
    FROM public.deals d
    JOIN public.contacts c ON c.id = d.primary_contact_id
    JOIN norm n ON lower(c.email) = n.email
   WHERE d.workspace_id = (SELECT id FROM ws);
$$;