import { AttachmentError, validateAttachmentMetadata } from './files.js';
import { MAX_ATTACHMENT_BYTES } from './shared.js';
export async function readAttachmentRequest(request) {
  const type = request.headers.get('content-type') || '';
  if (!/^multipart\/form-data\s*;/i.test(type) || type.length > 300) throw new AttachmentError(400);
  const limit = MAX_ATTACHMENT_BYTES + 20000;
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw new AttachmentError(413);
  if (!request.body) throw new AttachmentError(400);
  const reader = request.body.getReader(); const chunks = []; let length = 0;
  try {
    for (;;) {
      const {value,done} = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > limit || chunks.length >= 4096) throw new AttachmentError(413);
      chunks.push(value);
    }
  } catch (error) { try { await reader.cancel(); } catch {} throw error instanceof AttachmentError ? error : new AttachmentError(400); }
  finally { reader.releaseLock(); }
  let form;
  try { form = await new Response(Buffer.concat(chunks), { headers:{'Content-Type':type} }).formData(); }
  catch { throw new AttachmentError(400); }
  const allowed = new Set(['file','message','language','personaId','conversationId']); const body = {};
  for (const [key,value] of form) {
    if (!allowed.has(key) || form.getAll(key).length !== 1) throw new AttachmentError(400);
    if (key === 'file') continue;
    if (typeof value !== 'string' || value.length > 1500) throw new AttachmentError(400);
    body[key] = value;
  }
  const file = form.get('file'); validateAttachmentMetadata(file);
  if (body.conversationId === '') body.conversationId = null;
  return {body,file};
}
