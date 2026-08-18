import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "v3";

export class GhlReadError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
    this.name = "GhlReadError";
  }
}

export interface GhlContext {
  apiKey: string;
  locationId: string;
}

export async function resolveGhlContext(
  admin: SupabaseClient,
): Promise<GhlContext> {
  const { data, error } = await admin
    .from("app_settings")
    .select("key, value")
    .in("key", ["GHL_API_KEY", "GHL_LOCATION_ID"]);
  if (error) throw new GhlReadError(500, "ghl_configuration_lookup_failed");

  const settings: Record<string, string> = {};
  for (const row of data ?? []) {
    if (typeof row.key === "string" && typeof row.value === "string") {
      settings[row.key] = row.value;
    }
  }

  const apiKey = settings.GHL_API_KEY || Deno.env.get("GHL_API_KEY") || "";
  const locationId = settings.GHL_LOCATION_ID ||
    Deno.env.get("GHL_LOCATION_ID") || "";
  if (!apiKey || !locationId) {
    throw new GhlReadError(503, "ghl_not_configured");
  }
  return { apiKey, locationId };
}

export async function searchGhlContacts(
  context: GhlContext,
  input: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const data = await ghlJson(context, "/contacts/search", {
    method: "POST",
    body: {
      locationId: context.locationId,
      query: input.query,
      page: input.page,
      pageLimit: input.limit,
    },
  }, fetchImpl);
  const contacts = arrayAt(data, "contacts").slice(0, Number(input.limit));

  return {
    contacts: contacts.map(normalizeContact).filter((contact) => contact.id),
    total: safeNumber(data.total ?? recordAt(data, "meta").total),
    page: input.page,
    limit: input.limit,
  };
}

export async function getGhlContact(
  context: GhlContext,
  contactId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const data = await ghlJson(
    context,
    `/contacts/${encodeURIComponent(contactId)}`,
    undefined,
    fetchImpl,
  );
  return normalizeContact(recordAt(data, "contact"));
}

export async function createGhlContact(
  context: GhlContext,
  input: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = { locationId: context.locationId };
  copyDefined(body, "firstName", input.firstName);
  copyDefined(body, "lastName", input.lastName);
  copyDefined(body, "name", input.name);
  copyDefined(body, "email", input.email);
  copyDefined(body, "phone", input.phone);
  copyDefined(body, "companyName", input.companyName);
  copyDefined(body, "source", input.source);
  if (Array.isArray(input.tags)) {
    body.tags = input.tags.slice(0, 20).filter((value) => typeof value === "string");
  }

  const data = await ghlJson(context, "/contacts/", {
    method: "POST",
    body,
  }, fetchImpl);
  return normalizeContact(recordAt(data, "contact"));
}

export async function searchGhlOpportunities(
  context: GhlContext,
  input: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams({
    locationId: context.locationId,
    limit: String(input.limit),
    page: String(input.page),
  });
  setParam(params, "q", input.query);
  setParam(params, "contactId", input.contact_id);
  setParam(params, "pipelineId", input.pipeline_id);
  setParam(params, "pipelineStageId", input.stage_id);
  setParam(params, "status", input.status);

  const data = await ghlJson(
    context,
    `/opportunities/search?${params.toString()}`,
    undefined,
    fetchImpl,
  );
  const opportunities = arrayAt(data, "opportunities").slice(
    0,
    Number(input.limit),
  );

  return {
    opportunities: opportunities.map(normalizeOpportunity).filter((opportunity) => opportunity.id),
    total: safeNumber(recordAt(data, "meta").total ?? data.total),
    page: input.page,
    limit: input.limit,
  };
}

export async function getGhlOpportunity(
  context: GhlContext,
  opportunityId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const data = await ghlJson(
    context,
    `/opportunities/${encodeURIComponent(opportunityId)}`,
    undefined,
    fetchImpl,
  );
  return normalizeOpportunity(recordAt(data, "opportunity"));
}

export async function createGhlOpportunity(
  context: GhlContext,
  input: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    locationId: context.locationId,
    pipelineId: input.pipelineId,
    pipelineStageId: input.pipelineStageId,
    name: input.name,
    status: input.status,
    contactId: input.contactId,
  };
  if (Array.isArray(input.customFields) && input.customFields.length) {
    body.customFields = input.customFields;
  }

  const data = await ghlJson(context, "/opportunities/", {
    method: "POST",
    body,
  }, fetchImpl);
  return normalizeOpportunity(recordAt(data, "opportunity"));
}

export async function updateGhlOpportunity(
  context: GhlContext,
  opportunityId: string,
  input: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {};
  if (Array.isArray(input.customFields) && input.customFields.length) {
    body.customFields = input.customFields;
  }
  if (!Object.keys(body).length) {
    throw new GhlReadError(400, "ghl_empty_update_rejected");
  }

  const data = await ghlJson(
    context,
    `/opportunities/${encodeURIComponent(opportunityId)}`,
    { method: "PUT", body },
    fetchImpl,
  );
  return normalizeOpportunity(recordAt(data, "opportunity"));
}

export async function listGhlContactNotes(
  context: GhlContext,
  contactId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const data = await ghlJson(
    context,
    `/contacts/${encodeURIComponent(contactId)}/notes`,
    undefined,
    fetchImpl,
  );
  const notes = arrayAt(data, "notes").slice(0, 100);
  return {
    notes: notes.map((note) => ({
      id: safeString(note.id, 128),
      body: safeString(note.body, 5000),
      date_added: safeString(note.dateAdded, 64),
    })).filter((note) => note.id),
  };
}

export async function createGhlContactNote(
  context: GhlContext,
  contactId: string,
  bodyText: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const data = await ghlJson(
    context,
    `/contacts/${encodeURIComponent(contactId)}/notes`,
    { method: "POST", body: { body: bodyText.slice(0, 5000) } },
    fetchImpl,
  );
  const note = recordAt(data, "note");
  return {
    id: safeString(note.id, 128),
    body: safeString(note.body, 5000),
    date_added: safeString(note.dateAdded, 64),
  };
}

export async function listGhlPipelines(
  context: GhlContext,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams({ locationId: context.locationId });
  const data = await ghlJson(
    context,
    `/opportunities/pipelines?${params.toString()}`,
    undefined,
    fetchImpl,
  );
  const pipelines = arrayAt(data, "pipelines").slice(0, 100);

  return {
    pipelines: pipelines.map((pipeline) => ({
      id: safeString(pipeline.id, 128),
      name: safeString(pipeline.name, 300),
      stages: arrayAt(pipeline, "stages").slice(0, 100).map((stage) => ({
        id: safeString(stage.id, 128),
        name: safeString(stage.name, 300),
        position: safeNumber(stage.position),
      })).filter((stage) => stage.id),
    })).filter((pipeline) => pipeline.id),
  };
}

async function ghlJson(
  context: GhlContext,
  path: string,
  options: { method?: "GET" | "POST" | "PUT"; body?: Record<string, unknown> } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const url = new URL(`${GHL_BASE}${path}`);
  const method = options.method ?? "GET";
  const response = await fetchImpl(url, {
    method,
    headers: {
      Authorization: `Bearer ${context.apiKey}`,
      Version: GHL_VERSION,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    console.error(JSON.stringify({
      event: "agent_gateway_ghl_error",
      status: response.status,
      method,
      endpoint: url.pathname,
      version: GHL_VERSION,
    }));
    if (response.status === 401 || response.status === 403) {
      throw new GhlReadError(503, "ghl_not_authorized");
    }
    if (response.status === 404) {
      throw new GhlReadError(404, "ghl_resource_not_found");
    }
    if (response.status === 429) {
      throw new GhlReadError(503, "ghl_rate_limited");
    }
    if (response.status >= 400 && response.status < 500) {
      throw new GhlReadError(400, "ghl_request_rejected");
    }
    throw new GhlReadError(502, "ghl_request_failed");
  }

  const value: unknown = await response.json();
  if (!isRecord(value)) {
    throw new GhlReadError(502, "invalid_ghl_response");
  }
  return value;
}

function normalizeContact(contact: Record<string, unknown>): Record<string, unknown> {
  return {
    id: safeString(contact.id, 128),
    first_name: safeString(contact.firstName, 200),
    last_name: safeString(contact.lastName, 200),
    name: safeString(
      contact.name ?? [contact.firstName, contact.lastName].filter(Boolean).join(" "),
      400,
    ),
    email: safeString(contact.email, 320),
    phone: safeString(contact.phone, 64),
    company_name: safeString(contact.companyName, 300),
    source: safeString(contact.source, 200),
    tags: safeStringArray(contact.tags, 50, 100),
    date_added: safeString(contact.dateAdded, 64),
    date_updated: safeString(contact.dateUpdated, 64),
  };
}

function normalizeOpportunity(opportunity: Record<string, unknown>): Record<string, unknown> {
  const contact = isRecord(opportunity.contact) ? opportunity.contact : {};
  return {
    id: safeString(opportunity.id, 128),
    name: safeString(opportunity.name, 500),
    status: safeString(opportunity.status, 64),
    monetary_value: safeNumber(opportunity.monetaryValue),
    pipeline_id: safeString(opportunity.pipelineId, 128),
    stage_id: safeString(opportunity.pipelineStageId ?? opportunity.stageId, 128),
    contact_id: safeString(opportunity.contactId ?? contact.id, 128),
    contact_name: safeString(
      contact.name ?? [contact.firstName, contact.lastName].filter(Boolean).join(" "),
      400,
    ),
    source: safeString(opportunity.source, 200),
    date_added: safeString(opportunity.dateAdded ?? opportunity.createdAt, 64),
    date_updated: safeString(opportunity.dateUpdated ?? opportunity.updatedAt, 64),
  };
}

function copyDefined(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined && value !== null && value !== "") target[key] = value;
}

function setParam(
  params: URLSearchParams,
  name: string,
  value: unknown,
): void {
  if (typeof value === "string" && value) params.set(name, value);
}

function arrayAt(
  value: Record<string, unknown>,
  key: string,
): Array<Record<string, unknown>> {
  const candidate = value[key];
  return Array.isArray(candidate) ? candidate.filter(isRecord) : [];
}

function recordAt(
  value: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  return isRecord(value[key]) ? value[key] : {};
}

function safeString(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  return value.slice(0, maximum);
}

function safeStringArray(
  value: unknown,
  maximumItems: number,
  maximumLength: number,
): string[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maximumItems).flatMap((item) => {
    const result = safeString(item, maximumLength);
    return result === null ? [] : [result];
  });
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
