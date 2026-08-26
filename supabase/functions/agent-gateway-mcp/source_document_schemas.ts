import { z } from "npm:zod@3.25.76";

const candidateId = z.string().uuid();
const documentId = z.string().uuid();

export const dealListSourceDocumentsInputSchema = {
  candidate_id: candidateId,
};

export const dealReadSourceDocumentInputSchema = {
  candidate_id: candidateId,
  document_id: documentId,
};
