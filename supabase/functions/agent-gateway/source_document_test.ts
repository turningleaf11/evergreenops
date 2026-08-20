import { collectPdfAttachments, decodeBase64Url } from './source_document.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

Deno.test('collects only PDF source attachments from nested Gmail payloads', () => {
  const docs = collectPdfAttachments({
    mimeType: 'multipart/mixed',
    parts: [
      {
        filename: '2627-NW-25th-Ave-Property-Sheet.pdf',
        mimeType: 'application/pdf',
        body: { attachmentId: 'pdf-1', size: 125000 },
      },
      {
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        body: { attachmentId: 'img-1', size: 50000 },
      },
      {
        mimeType: 'multipart/alternative',
        parts: [{
          filename: 'second.pdf',
          mimeType: 'application/octet-stream',
          body: { attachmentId: 'pdf-2', size: 1000 },
        }],
      },
    ],
  });

  assertEquals(docs.map((doc) => doc.filename), [
    '2627-NW-25th-Ave-Property-Sheet.pdf',
    'second.pdf',
  ]);
  assertEquals(docs.map((doc) => doc.attachmentId), ['pdf-1', 'pdf-2']);
});

Deno.test('decodes Gmail base64url attachment data', () => {
  const encoded = btoa('Evergreen PDF').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const decoded = new TextDecoder().decode(decodeBase64Url(encoded));
  assert(decoded === 'Evergreen PDF');
});
