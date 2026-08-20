import {
  SourceDocumentError,
  collectPdfAttachments,
  decodeBase64Url,
  selectPdfAttachmentsForCandidate,
} from './source_document.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

function doc(filename: string, attachmentId: string) {
  return { filename, mimeType: 'application/pdf', attachmentId, inlineData: null, size: 1000 };
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

  assertEquals(docs.map((item) => item.filename), [
    '2627-NW-25th-Ave-Property-Sheet.pdf',
    'second.pdf',
  ]);
  assertEquals(docs.map((item) => item.attachmentId), ['pdf-1', 'pdf-2']);
});

Deno.test('multi-property email selects only the PDF matching the candidate address', () => {
  const selected = selectPdfAttachmentsForCandidate([
    doc('29910-SW-149th-Ave-Property-Sheet.pdf', 'a'),
    doc('2627-NW-25th-Ave-Property-Sheet.pdf', 'b'),
    doc('10470-SW-179th-St-Property-Sheet.pdf', 'c'),
    doc('11470-SW-43rd-Ter-Property-Sheet.pdf', 'd'),
    doc('578-NW-97th-St-Property-Sheet.pdf', 'e'),
  ], '2627 NW 25th Ave, Miami, FL 33142');

  assertEquals(selected.map((item) => item.filename), [
    '2627-NW-25th-Ave-Property-Sheet.pdf',
  ]);
});

Deno.test('portfolio package PDFs may accompany the address-matched source document', () => {
  const selected = selectPdfAttachmentsForCandidate([
    doc('123-Main-St-OM.pdf', 'a'),
    doc('Rent Roll.pdf', 'b'),
    doc('T12.pdf', 'c'),
    doc('P&L.pdf', 'd'),
    doc('999-Other-St-Property-Sheet.pdf', 'e'),
  ], '123 Main St, Miami, FL 33101');

  assertEquals(selected.map((item) => item.filename), [
    '123-Main-St-OM.pdf',
    'Rent Roll.pdf',
    'T12.pdf',
    'P&L.pdf',
  ]);
});

Deno.test('multiple unrelated PDFs fail closed instead of attaching all files', () => {
  try {
    selectPdfAttachmentsForCandidate([
      doc('Property-A.pdf', 'a'),
      doc('Property-B.pdf', 'b'),
    ], '2627 NW 25th Ave, Miami, FL 33142');
    throw new Error('Expected ambiguous source documents to be rejected');
  } catch (error) {
    assert(error instanceof SourceDocumentError);
    assertEquals(error.code, 'source_document_candidate_match_ambiguous');
  }
});

Deno.test('decodes Gmail base64url attachment data', () => {
  const encoded = btoa('Evergreen PDF').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const decoded = new TextDecoder().decode(decodeBase64Url(encoded));
  assert(decoded === 'Evergreen PDF');
});
