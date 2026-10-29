# Artifact images and document descriptions

Little De Rabbit / 小德兔 now accepts one JPG, PNG, WebP, PDF, DOCX, TXT or Markdown file per question. The existing travel profile keeps its own attachment behavior. Other custom museum profiles remain disabled until explicitly supported; an upload cannot switch a conversation's persona.

Use **Attach**, choose a file, optionally describe what you want to identify, and send. A file-only message gets a museum-specific prompt. Users can also type an artifact description, such as “a hexagonal basin with seven hollow tubes — what artifact is it?”

Limits: documents and the final uploaded file are at most 2 MB; images may be at most 8 MB and 16 megapixels before browser resizing. Images are decoded, resized and stripped of metadata again on the server. PDF files are limited to twelve pages. Text extraction is limited to 12,000 characters. Encrypted, malformed, animated, oversized or unsupported files are rejected. The bounded document worker does not execute macros, links or document instructions.

## How identification works

1. Authenticate, enforce quota, verify conversation ownership and resolve its published persona version before decoding or analyzing a file.
2. The separately configured image-capable model reads visible features and exhibit-label text from images or PDFs. DeepSeek remains the main text model; binary images are never sent to a text-only DeepSeek endpoint. DOCX/TXT/Markdown use bounded text extraction.
3. Treat the attachment, OCR and visitor description as untrusted evidence. The existing prompt-injection, harmful-request and privacy checks still apply. Redact detected personal identifiers throughout extracted text before forwarding it for matching. Reject requests to identify real people or locate private homes.
4. DeepSeek compares the evidence with artifact records from **this published museum persona only**. It returns record IDs and literal supporting quotes, not a free-form answer. Unknown IDs, invented quotes, duplicate fields, malformed envelopes, low-confidence visual claims and weak generic resemblance fail closed.
5. The server renders the selected record's name, description and existing reference links with a visible **suggested match** notice. It does not establish authenticity, ownership, an accession number, current display or exact location. A generic vase without distinctive evidence should prompt for its label rather than a definitive identification.

The selected catalogue is incomplete. Similar objects may exist at other museums; recognition is a candidate reference match, not an expert attribution. Human review remains appropriate for important identifications. Lexical grounding checks add a conservative boundary, not proof that the model understood every image correctly.

Raw files, image bytes, OCR and extracted document text are request-only. They are sent to the configured AI providers for processing, not used to train this application. The application stores the user's question, a bounded filename marker and the server-rendered reference reply in the private conversation; it does not upload originals to Supabase Storage. Provider retention depends on the configured provider's terms. Avoid uploading personal or confidential documents.

The referenced artifact can be discussed in follow-up using its published description in server-owned chat history. A new visual or document-specific detail requires reattaching the file. The UI distinguishes candidate matches, clarification and recognition-unavailable states; a provider failure never becomes a fabricated identification.

## Checks

`tests/museum-attachments.test.mjs` covers images, PDFs, labels and typed descriptions; privacy and later-page injection; malformed observation/matcher output; unknown/cross-museum IDs; invented evidence; generic-photo ambiguity; authentication, quota, ownership and persona binding; and private transcript persistence. The existing attachment suite verifies MIME/magic-byte agreement, image normalization, PDF rebuilding, DOCX protections and bounded parsing. Live provider and browser checks are recorded separately from these simulated service tests.
