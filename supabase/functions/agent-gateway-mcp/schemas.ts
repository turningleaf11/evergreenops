import { z } from "npm:zod@3.25.76";

const gmailId = z.string().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/);
const pageToken = z.string().min(1).max(2048).regex(/^[A-Za-z0-9_-]+$/)
  .optional();
const maxResults = z.number().int().min(1).max(50).optional();
const ghlId = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);

export const emailListInputSchema = {
  max_results: maxResults,
  page_token: pageToken,
  after_epoch_seconds: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
    .optional(),
};

export const emailSearchInputSchema = {
  query: z.string().trim().min(1).max(500),
  max_results: maxResults,
  page_token: pageToken,
};

export const emailReadInputSchema = {
  thread_id: gmailId,
};

export const emailGetAttachmentInputSchema = {
  message_id: gmailId,
  attachment_id: gmailId,
  max_bytes: z.number().int().min(64 * 1024).max(8 * 1024 * 1024).optional(),
};

export const crmSearchContactsInputSchema = {
  query: z.string().trim().min(1).max(75),
  limit: z.number().int().min(1).max(20).optional(),
  page: z.number().int().min(1).max(1000).optional(),
};

export const crmSearchOpportunitiesInputSchema = {
  query: z.string().trim().min(1).max(200).optional(),
  contact_id: ghlId.optional(),
  pipeline_id: ghlId.optional(),
  stage_id: ghlId.optional(),
  status: z.enum(["open", "won", "lost", "abandoned", "all"]).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  page: z.number().int().min(1).max(1000).optional(),
};

export const crmListPipelinesInputSchema = {};

export const emailInputValidators = {
  email_list: z.object(emailListInputSchema),
  email_search: z.object(emailSearchInputSchema),
  email_read: z.object(emailReadInputSchema),
  email_get_attachment: z.object(emailGetAttachmentInputSchema),
  crm_search_contacts: z.object(crmSearchContactsInputSchema),
  crm_search_opportunities: z.object(crmSearchOpportunitiesInputSchema).refine(
    (value) => Boolean(value.query || value.contact_id),
    { message: "query or contact_id is required" },
  ),
  crm_list_pipelines: z.object(crmListPipelinesInputSchema),
} as const;
