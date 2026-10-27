// No network, filesystem reads, macros, scripts or external relationships are executed.
const { parentPort, workerData } = require('node:worker_threads');
const { unzipSync } = require('fflate');
const { PDFDocument, PDFName } = require('pdf-lib');
const MAX_TEXT = 12000;
function xmlText(xml) {
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(xml)) throw new Error('Unsupported XML');
  const chunks = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map(match => match[1]);
  const text = chunks.join(' ').replace(/&(?:amp|lt|gt|quot|apos|#\d{1,7}|#x[\da-f]{1,6});/gi, entity => {
    const named = { '&amp;':'&', '&lt;':'<', '&gt;':'>', '&quot;':'"', '&apos;':"'" };
    if (named[entity]) return named[entity];
    const number = entity[2].toLowerCase() === 'x' ? parseInt(entity.slice(3, -1), 16) : Number(entity.slice(2, -1));
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : ' ';
  }).trim();
  if (!text || text.length > MAX_TEXT || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new Error('Invalid text');
  return text;
}
(async () => {
  const data = new Uint8Array(workerData.bytes);
  if (workerData.kind === 'docx') {
    let entries = 0; let expanded = 0; let mainFiles = 0;
    const files = unzipSync(data, { filter(entry) {
      if (++entries > 256 || entry.originalSize > 8 * 1024 * 1024 || (expanded += entry.originalSize) > 12 * 1024 * 1024 ||
          entry.originalSize > Math.max(1024, entry.size * 150) || /\.\.|^[/\\]|vbaProject|\.bin$/i.test(entry.name)) throw new Error('Unsafe archive');
      if (entry.name !== 'word/document.xml') return false;
      if (++mainFiles > 1 || entry.originalSize > 256 * 1024) throw new Error('Unsafe XML');
      return true;
    }});
    if (!files['word/document.xml']) throw new Error('Not DOCX');
    const xml = new TextDecoder('utf-8', { fatal:true }).decode(files['word/document.xml']);
    parentPort.postMessage({ text: xmlText(xml) });
  } else if (workerData.kind === 'pdf') {
    const pdf = await PDFDocument.load(data, { ignoreEncryption:false, updateMetadata:false, throwOnInvalidObject:true });
    if (pdf.isEncrypted || pdf.getPageCount() < 1 || pdf.getPageCount() > 12) throw new Error('Page limit');
    // Rebuild only pages, discarding catalog actions, forms, attachments and metadata.
    const clean = await PDFDocument.create();
    const pages = await clean.copyPages(pdf, pdf.getPageIndices());
    for (const page of pages) {
      for (const key of ['Annots','AA','Metadata','PresSteps']) page.node.delete(PDFName.of(key));
      const {width,height} = page.getSize();
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > 4000 || height > 4000) throw new Error('Page dimensions');
      clean.addPage(page);
    }
    const bytes = await clean.save();
    if (bytes.length > 2 * 1024 * 1024) throw new Error('Output limit');
    parentPort.postMessage({ bytes, pages: pages.length });
  } else throw new Error('Invalid kind');
})().catch(() => parentPort.postMessage({ error:true }));
