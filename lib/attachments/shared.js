export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
export const MAX_ATTACHMENT_MESSAGE = 1300;
export const ATTACHMENT_ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.docx,.txt,.md';
const EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf', 'docx', 'txt', 'md']);
export function attachmentExtension(name) { return String(name).toLowerCase().split('.').at(-1); }
export function safeAttachmentName(name) {
  const base = String(name).split(/[\\/]/).at(-1).normalize('NFKC').replace(/[^\p{L}\p{N} ._()-]/gu, '_');
  const extension = attachmentExtension(base);
  if (!EXTENSIONS.has(extension)) return null;
  return (base.slice(0, -(extension.length + 1)).slice(0, 65) || 'attachment') + '.' + extension;
}
export function attachmentPrompt(message, language = 'en') {
  return String(message || '').trim() || (language === 'zh'
    ? '请辨认图片中的中国公共景点，或说明附件中的中国旅游信息。'
    : 'Please identify the public place in China, or explain the China-travel information in this attachment.');
}
export function attachmentTranscript(message, name, language = 'en') {
  return attachmentPrompt(message, language) + '\n\n[' + (language === 'zh' ? '附件：' : 'Attached: ') + safeAttachmentName(name) + ']';
}
