"use client";
import { useEffect, useState } from 'react';
import AttachmentPicker from '../AttachmentPicker.jsx';
import { GlossyButton } from './ui/Glossy.jsx';
import GlassChatbot from './chat/GlassChatbot.jsx';
import { DESHOU_PERSONA } from '../../data/personas/deshou-palace.js';
const vessel=DESHOU_PERSONA.knowledge.find(record=>record.id==='DS005');
export default function AskTab({messages=[],historyItems=[],activeHistoryId,onSelectHistory,onNewHistory,historyLoading,historyError,onRetryHistory,attachmentEnabled,attachment,attachmentBusy,sessionImages={},onAttachmentChange,onAttachmentBusy,onAttachmentError,...props}) {
 const zh = props.language === 'zh';
 const disabled = props.isLoading || historyLoading || !props.onSend;
 const attachmentControl = attachmentEnabled && <AttachmentPicker
   key={activeHistoryId} imageOnly showPreview={false} museum language={props.language}
   disabled={disabled || attachmentBusy} file={attachment}
   onChange={onAttachmentChange} onBusy={onAttachmentBusy} onError={onAttachmentError}
 />;
 const attachmentPreview = attachment && (
   <div className="mb-2 flex w-fit max-w-full items-center gap-2 rounded-full border border-white/20 px-2 py-1">
     <UploadImage file={attachment} thumbnail />
     <span className="truncate text-xs">{attachment.name}</span>
     <GlossyButton disabled={disabled} onClick={()=>onAttachmentChange(null)}
       aria-label={zh ? '移除图片' : 'Remove image'}>×</GlossyButton>
   </div>
 );
 const illustrated=messages.map(message=>message.role==='assistant' && message.safety==='allowed' && message.faq?.id==='DS005' && [vessel.question_en,vessel.question_zh].includes(message.faq.question)
 ? {...message,image_url:'/artifacts/deshou/seven-tube-vessel.jpg',artifact_name:'Longquan seven-tube flower vessel',image_credit:'Siyuwj · Wikimedia Commons · CC BY-SA 4.0'}:message);
 return <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'28px 0',gap:12}}><div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}><label>Conversations <select aria-label="Saved conversations" value={activeHistoryId||""} onChange={event=>onSelectHistory?.(event.target.value)} style={{background:"#173b30",color:"#f7f3e9",padding:10,borderRadius:12}}>{historyItems.map(item=><option key={item.id} value={item.id}>{item.title||"New conversation"}</option>)}</select></label><GlossyButton onClick={()=>onNewHistory?.()}>New conversation</GlossyButton>{historyLoading&&<span role="status">Loading your history…</span>}{historyError&&<GlossyButton onClick={onRetryHistory}>Retry history sync</GlossyButton>}</div><GlassChatbot key={activeHistoryId || "loading"} {...props} attachmentControl={attachmentControl} attachmentPreview={attachmentPreview} hasAttachment={Boolean(attachment)} preparingAttachment={attachmentBusy} renderUserImage={message=>sessionImages[message.id] && <UploadImage file={sessionImages[message.id]} />} messages={illustrated} className="!relative !inset-auto !w-full !max-w-3xl !h-[min(680px,70dvh)]"/></div>;
}




function UploadImage({file, thumbnail = false}) {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview({file, url});
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (preview?.file !== file) return null;
  return <img src={preview.url} alt={thumbnail ? '' : file.name}
    className={thumbnail ? 'size-9 shrink-0 rounded-full object-cover' : 'mt-3 max-h-64 max-w-full rounded-xl object-contain'} />;
}
