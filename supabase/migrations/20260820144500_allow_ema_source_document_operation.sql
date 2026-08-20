-- Allow the scoped Agent Gateway source-document attachment operation to be
-- recorded in ema_operations. The operation remains behind the existing
-- deal.intake_to_crm permission and does not add any new agent capability.

ALTER TABLE public.ema_operations
  DROP CONSTRAINT IF EXISTS ema_operations_operation_type_check;

ALTER TABLE public.ema_operations
  ADD CONSTRAINT ema_operations_operation_type_check
  CHECK (operation_type = ANY (ARRAY[
    'cash_task_create'::text,
    'ghl_contact_upsert'::text,
    'ghl_opportunity_create'::text,
    'ghl_opportunity_update'::text,
    'ghl_opportunity_note_create'::text,
    'ghl_opportunity_source_document_attach'::text,
    'gmail_draft_create'::text,
    'gmail_label_apply'::text,
    'gmail_mark_read'::text
  ]));
