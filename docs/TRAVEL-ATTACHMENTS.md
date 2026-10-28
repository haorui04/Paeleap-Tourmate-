# Travel images and documents

TourMate accepts one JPG/JPEG, PNG, WebP, PDF, DOCX, UTF-8 TXT or Markdown file alongside a question. A question is optional: attaching a file and pressing Send requests a public-place identification or a China-travel explanation. The paperclip control appears when attachment processing is configured. English and Chinese are supported.

## What is supported

- Maximum uploaded file: 2 MiB. The browser can accept an image up to 8 MiB / 16 megapixels, resize it to 1536 pixels on its longest side and re-encode it before uploading. The server independently verifies and normalizes image bytes, strips metadata, rejects animation and enforces its own limits.
- PDF: at most 12 pages. Scanned pages and text PDFs go to the configured image/PDF-capable model. Encrypted, invalid, unusually large-page or complex PDFs are rejected. The server rebuilds page-only PDFs, removing catalog metadata, forms, attachments and page annotations/actions. Nothing is executed or rendered in the visitor's browser.
- DOCX: main-body text only, up to 12,000 extracted characters. Images, headers/footers, comments, macros and external relationships are not read or executed. Export image-only Word documents as a short PDF instead.
- TXT/Markdown: UTF-8, up to 48 KiB and 12,000 characters. Markdown/HTML is treated as text, never rendered as executable HTML.
- Location identification concerns public landmarks. It is a model suggestion, not verified geolocation. Unclear photos require a clearer photo or city hint. People, private-home identification and identity/payment documents are excluded.

Example questions: `Where is this public landmark in China?`, `What place and city does this brochure describe?`, `请说明这份旅游资料里的景点和城市。`

## Model configuration and data flow

The normal chat model remains `AI_MODEL=deepseek/deepseek-v3.1`. This model is text-only. `AI_VISION_MODEL=google/gemini-2.5-flash-lite` supplies native image/PDF perception through the same server-only Vercel AI Gateway key and `AI_BASE_URL`. No OpenAI model is introduced. Other providers must explicitly support images and native PDFs through the Chat Completions format before enabling this setting. The main text-answer adapter still honors `AI_API_STYLE`.

1. The bounded multipart reader accepts only `file`, `message`, `language`, `personaId` and `conversationId`, once each. Duplicate fields, extra files and JSON attachment objects are rejected. Attached questions have a 1,300-character limit; ordinary messages retain 1,500.
2. Supabase authentication, existing per-user quotas, conversation ownership, pinned persona/version and input checks run before file decoding or inference. Attachment use consumes the same quota as chat. Custom museum profiles keep their approved-knowledge boundary and do not accept global attachments.
3. Text/DOCX contents are inspected in overlapping windows across the full extracted text. Document parsers run inside an 8-second, memory-limited Node worker. ZIP expansion, entry counts, XML and PDF page sizes are bounded. No URLs from files are fetched. No upload destination, model, endpoint or role can be chosen by a visitor.
4. Images/PDFs first produce a strictly validated observation envelope, with a JSON schema explicitly requested from the provider. Property order is immaterial; duplicate, escaped and extra keys remain rejected. Incidental visitors in landmark photos are ignored; person-identification requests remain blocked. Only observations are passed to DeepSeek as explicitly untrusted reference data; file instructions, prior private conversations and credentials never become system instructions. The perception call receives no visitor question, filename, bearer token, database records or conversation history. The answer call receives a redacted question and relevant extracted observations, not image bytes.
5. DeepSeek writes a concise China-travel answer. Structured-output, persona, scope, secret-pattern and numeric-evidence checks apply before display. Suspicious observations are refused; invalid/unverified answers are replaced with a fixed message. The model has no tools, external fetching, database queries, code execution or account actions.

The expanded travel knowledge bank remains optional reference material for ordinary generated chat; see [coverage and research limits](CHINA-TRAVEL-KNOWLEDGE.md). An uploaded file is reference data for that request; it does not train/fine-tune the model, change the persona or become a permanent knowledge source.

## Retention and limitations

The application keeps raw files only in request/browser memory. It creates no Supabase Storage objects, attachment table, public file URL or temporary disk upload. libvips image caching is disabled. Pending selections stay with their chat in memory and disappear after reload/sign-out; local preview object URLs are revoked. Only the question, sanitized filename marker and final answer enter the ordinary conversation transcript, browser cache and Supabase messages. Deleting that chat uses the existing secure conversation/message deletion flow.

The AI Gateway and selected providers process the submitted file/observations under their own account, logging and retention policies. This implementation does not claim to control those providers' retention or certify zero retention. Do not upload IDs, financial documents, private data or secrets. Reattach the original file to ask new questions about its contents; earlier file bytes/OCR are not stored as reusable model context.

File validation, layered prompting and output checks reduce risk but cannot prove every semantic claim or prevent every novel multimodal injection. Model self-reported confidence is not a calibrated probability. Verify important location claims and review provider/privacy and regional requirements before public use.

## Verification

`node --test tests/attachments.test.mjs tests/weather.test.mjs` covers file formats, parser limits, archive/XML attacks, malformed perception envelopes, OCR/document instructions, hostile generated answers, privacy, authentication, quotas, conversation ownership and museum isolation. `npm test`, strict remediation replay and the production build cover regressions. Live-provider and isolated browser results are recorded separately; mocked tests are never described as live-model evaluations.

Provider format reference: [AI Gateway image/PDF Chat Completions](https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions/images).
