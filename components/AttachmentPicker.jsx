"use client";
import { useEffect, useRef, useState } from 'react';
import { ATTACHMENT_ACCEPT } from '../lib/attachments/shared.js';
import { prepareClientAttachment } from '../lib/client/attachments.js';

export default function AttachmentPicker({file,language,disabled,onChange,onBusy,onError}) {
  const input = useRef(null); const sequence = useRef(0); const [preview,setPreview] = useState('');
  useEffect(() => () => { sequence.current += 1; }, []);
  useEffect(() => {
    if (!file?.type.startsWith('image/')) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  },[file]);
  async function select(event) {
    const selected = event.target.files?.[0]; event.target.value = '';
    if (!selected) return;
    const current = ++sequence.current; onBusy(true); onError('');
    try {
      const prepared = await prepareClientAttachment(selected);
      if (current === sequence.current) onChange(prepared);
    } catch(error) {
      if (current === sequence.current) onError(language === 'zh'
        ? error.message === 'size' ? '文件过大。文档限 2 MB，图片限 8 MB、1600 万像素；图片会在上传前缩小。' : '请选择 JPG、PNG、WebP、PDF、DOCX、TXT 或 Markdown 文件。'
        : error.message === 'size' ? 'File too large. Documents: 2 MB. Images: 8 MB and 16 megapixels before resizing.' : 'Choose a JPG, PNG, WebP, PDF, DOCX, TXT or Markdown file.');
    } finally { if(current === sequence.current) onBusy(false); }
  }
  return <div className="attachment-picker">
    <input ref={input} type="file" className="sr-only" accept={ATTACHMENT_ACCEPT} onChange={select} disabled={disabled} aria-label={language === 'zh' ? '选择图片或旅游文档' : 'Choose an image or travel document'} tabIndex={-1}/>
    <button className="attach-button" type="button" onClick={()=>input.current?.click()} disabled={disabled} aria-label={language === 'zh' ? '添加图片或文件' : 'Attach an image or document'} title={language === 'zh' ? '图片、PDF、DOCX、TXT、Markdown · 单个文件 2 MB' : 'Image, PDF, DOCX, TXT, Markdown · one file, 2 MB'}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m8 13 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9a6 6 0 0 1 8 8l-8 8"/></svg>
      {language === 'zh' ? '附件' : 'Attach'}
    </button>
    {file && <div className="attachment-chip">
      {preview && <img src={preview} alt="" width="36" height="36"/>}
      <span title={file.name}>{file.name}<small>{Math.max(1,Math.round(file.size/1024))} KB</small></span>
      <button type="button" disabled={disabled} onClick={()=>onChange(null)} aria-label={language === 'zh' ? '移除附件' : 'Remove attachment'}>×</button>
    </div>}
  </div>;
}
