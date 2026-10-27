import { MAX_ATTACHMENT_BYTES, safeAttachmentName, attachmentExtension } from '../attachments/shared.js';
export async function prepareClientAttachment(file) {
  const name = safeAttachmentName(file?.name);
  if (!name || !file.size) throw new Error('format');
  const image = ['jpg','jpeg','png','webp'].includes(attachmentExtension(name));
  if (file.size > (image ? 8 * 1024 * 1024 : MAX_ATTACHMENT_BYTES)) throw new Error('size');
  if (!image) return new File([file], name, {type:file.type || 'application/octet-stream'});
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    if (bitmap.width * bitmap.height > 16000000) throw new Error('size');
    const scale = Math.min(1,1536 / Math.max(bitmap.width,bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.round(bitmap.width*scale)); canvas.height = Math.max(1,Math.round(bitmap.height*scale));
    const context = canvas.getContext('2d'); if (!context) throw new Error('format');
    context.fillStyle = '#fff'; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',0.85));
    canvas.width = 1; canvas.height = 1;
    if (!blob || blob.size > MAX_ATTACHMENT_BYTES) throw new Error('size');
    return new File([blob],name.replace(/\.[^.]+$/,'.jpg'),{type:'image/jpeg'});
  } catch (error) { throw new Error(error.message === 'size' ? 'size' : 'format'); }
  finally { bitmap?.close(); }
}
