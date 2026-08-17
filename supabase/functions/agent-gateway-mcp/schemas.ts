import { z } from "npm:zod@3.25.76";

const gmailId = z.string().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/);
const pageToken = z.string().min(1).max(2048).regex(/^[A-Za-z0-9_-]+$/)
  .optional();
const maxResults = z.number().int().min(1).max(50).optional();

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
};

export const emailInputValidators = {
  email_list: z.object(emailListInputSchema),
  email_search: z.object(emailSearchInputSchema),
  email_read: z.object(emailReadInputSchema),
  email_get_attachment: z.object(emailGetAttachmentInputSchema),
} as const;
