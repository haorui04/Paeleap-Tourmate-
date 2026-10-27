import sharp from 'sharp';
import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import { MAX_ATTACHMENT_BYTES, safeAttachmentName, attachmentExtension } from './shared.js';
// Do not retain decoded visitor images in libvips' process-wide operation cache.
sharp.cache(false);

export class AttachmentError extends Error {
  constructor(status = 415) { super('Invalid or unsupported attachment'); this.status = status; }
}
const MIME = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', pdf:'application/pdf',
  docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt:'text/plain', md:'text/markdown' };
export function validateAttachmentMetadata(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || !Number.isInteger(file.size) || file.size < 1) throw new AttachmentError(400);
  if (file.size > MAX_ATTACHMENT_BYTES) throw new AttachmentError(413);
  const name = safeAttachmentName(file.name); const extension = attachmentExtension(file.name);
  const type = file.type?.split(';')[0].toLowerCase();
  if (!name || !(extension in MIME) || (type && type !== MIME[extension] && !(extension === 'md' && type === 'text/plain') && type !== 'application/octet-stream')) throw new AttachmentError();
  return { name, extension, type: MIME[extension] };
}
async function documentWorker(bytes, kind) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(join(process.cwd(), 'lib/attachments/document-worker.cjs'), {
      workerData: { bytes, kind }, stdout:true, stderr:true,
      resourceLimits:{ maxOldGenerationSizeMb:64, maxYoungGenerationSizeMb:16, stackSizeMb:4 }
    });
    // Discard parser diagnostics; malformed documents must not enter app logs.
    worker.stdout.resume(); worker.stderr.resume();
    let settled = false;
    const finish = (error, result) => {
      if (settled) return; settled = true; clearTimeout(timer); void worker.terminate();
      if (error) reject(new AttachmentError()); else resolve(result);
    };
    const timer = setTimeout(() => finish(true), 8000);
    worker.once('message', result => finish(!result || result.error, result));
    worker.once('error', () => finish(true));
    worker.once('exit', () => { if (!settled) finish(true); });
  });
}
export async function prepareAttachment(file) {
  const meta = validateAttachmentMetadata(file);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || bytes.length > MAX_ATTACHMENT_BYTES) throw new AttachmentError(413);
  try {
    if (meta.type.startsWith('image/')) {
      const decoder = sharp(bytes, { limitInputPixels:16000000, failOn:'warning', animated:false });
      const info = await decoder.metadata();
      if (!['jpeg','png','webp'].includes(info.format) || (info.pages || 1) !== 1 || !info.width || !info.height ||
          !({ jpg:'jpeg', jpeg:'jpeg', png:'png', webp:'webp' }[meta.extension] === info.format)) throw new AttachmentError();
      const clean = await decoder.rotate().resize({width:1536,height:1536,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).jpeg({quality:85}).toBuffer();
      if (clean.length > MAX_ATTACHMENT_BYTES) throw new AttachmentError(413);
      return { name:meta.name, kind:'image', type:'image/jpeg', bytes:clean };
    }
    if (meta.extension === 'pdf') {
      if (bytes.subarray(0,5).toString() !== '%PDF-' || !bytes.subarray(-2048).includes(Buffer.from('%%EOF'))) throw new AttachmentError();
      const result = await documentWorker(bytes, 'pdf');
      return {name:meta.name,kind:'pdf',type:meta.type,bytes:Buffer.from(result.bytes),pages:result.pages};
    }
    let text;
    if (meta.extension === 'docx') {
      if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 3 || bytes[3] !== 4) throw new AttachmentError();
      text = (await documentWorker(bytes, 'docx')).text;
    } else {
      if (bytes.length > 48 * 1024) throw new AttachmentError(413);
      text = new TextDecoder('utf-8', {fatal:true}).decode(bytes).trim();
    }
    if (!text || text.length > 12000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new AttachmentError();
    return { name:meta.name, kind:'text', type:'text/plain', text };
  } catch (error) {
    if (error instanceof AttachmentError) throw error;
    throw new AttachmentError();
  }
}
