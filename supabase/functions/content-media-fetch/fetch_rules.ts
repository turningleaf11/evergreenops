// Rules for fetching inbound media. Separated from the worker so the parts that
// must be right are testable without network or storage.
//
// THE SSRF PROBLEM. A media reference arrives inside an external payload. For
// Twilio it is a full URL, taken verbatim from a webhook body. This server has
// a service-role key and sits inside Supabase's network, so a reference
// pointing at 169.254.169.254, or at a Supabase internal address, would have it
// fetch that and store the result — turning "Autumn sent a photo" into a
// credential read. A valid provider signature does not help: it proves the
// envelope, not that every URL inside it is one we should call.
//
// So references are never fetched as given. Meta ids are resolved through the
// Graph API and the resulting URL is host-checked; Twilio URLs are host-checked
// directly. Anything else is refused.

export const META_MEDIA_HOSTS = ['lookaside.fbsbx.com', 'graph.facebook.com'];
export const TWILIO_MEDIA_HOSTS = ['api.twilio.com', 'media.twiliocdn.com'];

export const MAX_MEDIA_BYTES = 16 * 1024 * 1024;

// Only what the content pipeline can actually use. An agent cannot caption a
// PDF, and storing arbitrary file types from an inbound channel is a liability
// with no upside.
export const SUPPORTED_MIME_PREFIXES = ['image/', 'video/'];

export function isAllowedMediaUrl(rawUrl: string, provider: 'meta' | 'twilio'): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const allowed = provider === 'meta' ? META_MEDIA_HOSTS : TWILIO_MEDIA_HOSTS;
  // Exact host match, and subdomains only of an allowed host. Substring
  // matching would accept "lookaside.fbsbx.com.evil.test".
  return allowed.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

export function isSupportedMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return SUPPORTED_MIME_PREFIXES.some((prefix) => mimeType.toLowerCase().startsWith(prefix));
}

// Extension from mime rather than from any attacker-influenced filename.
export function extensionForMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/gif': 'gif', 'image/heic': 'heic', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
    'video/3gpp': '3gp', 'video/webm': 'webm',
  };
  return map[mimeType.toLowerCase().split(';')[0].trim()] ?? 'bin';
}

// Path is composed entirely from values we control — never from the provider's
// filename, which is external input and would be a path-traversal vector.
export function storagePathFor(workspaceId: string, mediaId: string, mimeType: string): string {
  const safeWorkspace = workspaceId.replace(/[^a-z0-9-]/gi, '');
  const safeId = mediaId.replace(/[^a-z0-9-]/gi, '');
  const date = new Date().toISOString().slice(0, 10);
  return `${safeWorkspace}/${date}/${safeId}.${extensionForMime(mimeType)}`;
}

export function classifyFailure(status: number): 'retry' | 'permanent' {
  // 404 and 410 mean the provider has expired the media — WhatsApp media is
  // short-lived. Retrying that forever is pointless; retrying a 5xx is not.
  if (status === 404 || status === 410 || status === 403) return 'permanent';
  return 'retry';
}
