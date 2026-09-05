import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  classifyFailure,
  extensionForMime,
  isAllowedMediaUrl,
  isSupportedMime,
  storagePathFor,
} from './fetch_rules.ts';

// The reference arrives inside an external payload, and this worker holds a
// service-role key inside Supabase's network. Fetching a reference as given
// would turn "Autumn sent a photo" into a credential read.
Deno.test('cloud metadata and internal addresses are refused', () => {
  const hostile = [
    'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
    'https://169.254.169.254/latest/meta-data/',
    'http://localhost:8000/',
    'https://127.0.0.1/',
    'https://10.0.0.5/internal',
    'https://kong:8000/rest/v1/agent_api_credentials',
    'file:///etc/passwd',
  ];
  for (const url of hostile) {
    assertEquals(isAllowedMediaUrl(url, 'meta'), false, `allowed hostile url: ${url}`);
    assertEquals(isAllowedMediaUrl(url, 'twilio'), false, `allowed hostile url: ${url}`);
  }
});

Deno.test('only the provider hosts are fetched, over https', () => {
  assertEquals(isAllowedMediaUrl('https://lookaside.fbsbx.com/whatsapp/media/1', 'meta'), true);
  assertEquals(isAllowedMediaUrl('https://graph.facebook.com/v21.0/123', 'meta'), true);
  assertEquals(isAllowedMediaUrl('https://api.twilio.com/2010-04-01/Media/ME1', 'twilio'), true);

  // Right host, wrong provider.
  assertEquals(isAllowedMediaUrl('https://api.twilio.com/x', 'meta'), false);
  assertEquals(isAllowedMediaUrl('https://lookaside.fbsbx.com/x', 'twilio'), false);
  // Plaintext is refused even on an allowed host — the token travels on it.
  assertEquals(isAllowedMediaUrl('http://lookaside.fbsbx.com/x', 'meta'), false);
  assertEquals(isAllowedMediaUrl('not a url at all', 'meta'), false);
});

// The classic near-miss: substring matching would accept all of these.
Deno.test('lookalike hostnames are refused', () => {
  const lookalikes = [
    'https://lookaside.fbsbx.com.evil.test/x',
    'https://api.twilio.com.attacker.io/x',
    'https://evil-lookaside.fbsbx.com.co/x',
    'https://notgraph.facebook.com.bad/x',
  ];
  for (const url of lookalikes) {
    assertEquals(isAllowedMediaUrl(url, 'meta'), false, `allowed lookalike: ${url}`);
    assertEquals(isAllowedMediaUrl(url, 'twilio'), false, `allowed lookalike: ${url}`);
  }
  // Genuine subdomains of an allowed host stay allowed.
  assertEquals(isAllowedMediaUrl('https://cdn.lookaside.fbsbx.com/x', 'meta'), true);
});

Deno.test('only image and video are stored', () => {
  assertEquals(isSupportedMime('image/jpeg'), true);
  assertEquals(isSupportedMime('video/mp4'), true);
  assertEquals(isSupportedMime('IMAGE/PNG'), true);
  assertEquals(isSupportedMime('application/pdf'), false);
  assertEquals(isSupportedMime('text/html'), false);
  assertEquals(isSupportedMime('application/x-sh'), false);
  assertEquals(isSupportedMime(null), false);
  assertEquals(isSupportedMime(''), false);
});

// The path is built only from values we control. A provider filename is
// external input and would be a traversal vector.
Deno.test('storage paths cannot be escaped', () => {
  const path = storagePathFor('../../etc', '../../../passwd', 'image/jpeg');
  assertEquals(path.includes('..'), false);
  assertEquals(path.includes('/etc'), false);
  assertEquals(path.endsWith('.jpg'), true);

  const clean = storagePathFor('11111111-1111-1111-1111-111111111111', 'abcd-1234', 'video/mp4');
  assertEquals(clean.startsWith('11111111-1111-1111-1111-111111111111/'), true);
  assertEquals(clean.endsWith('abcd-1234.mp4'), true);
});

Deno.test('extensions come from mime, not from a filename', () => {
  assertEquals(extensionForMime('image/jpeg'), 'jpg');
  assertEquals(extensionForMime('image/jpeg; charset=binary'), 'jpg');
  assertEquals(extensionForMime('video/quicktime'), 'mov');
  assertEquals(extensionForMime('application/octet-stream'), 'bin');
});

// WhatsApp media expires. Retrying an expired reference until the attempt cap
// just calls a host that will keep saying no.
Deno.test('expired media is permanent, server errors are retried', () => {
  assertEquals(classifyFailure(404), 'permanent');
  assertEquals(classifyFailure(410), 'permanent');
  assertEquals(classifyFailure(403), 'permanent');
  assertEquals(classifyFailure(500), 'retry');
  assertEquals(classifyFailure(503), 'retry');
  assertEquals(classifyFailure(429), 'retry');
});
