import {createClient} from "@supabase/supabase-js";
import {createHash} from "node:crypto";
import {PersonaError,validatePersonaPackage} from "../personas/validation.js";
import {attachmentTextSafe} from "../attachments/analyze.js";
export const KNOWLEDGE_BUCKET="tourmate-knowledge";
export function connectionLink(link,env=process.env){
 let source,project;try{source=new URL(link);project=new URL(env.SUPABASE_URL);}catch{throw new PersonaError("Use this application's connected Supabase project URL");}
 if(project.protocol!=="https:"||source.origin!==project.origin||source.username||source.password||source.search||source.hash)throw new PersonaError("Only the currently connected Supabase project is allowed. Do not paste keys or signed URLs.");
 if(source.pathname==="/")return {project:project.origin,path:null};
 const match=source.pathname.match(/^\/storage\/v1\/object\/(?:public|authenticated)\/tourmate-knowledge\/(.+)$/);
 if(!match)throw new PersonaError("Use the project URL or a file link in tourmate-knowledge");
 return {project:project.origin,path:knowledgePath(match[1])};
}
export function knowledgePath(path){
 if(typeof path!=="string"||!path||path.length>250||!/^[-a-zA-Z0-9_./]+$/.test(path)||path.split("/").some(part=>!part||part==="."||part==="..")||!/[.](json|txt|md)$/i.test(path))throw new PersonaError("Use a JSON, TXT or Markdown file path without traversal or signed parameters");
 return path;
}
export function validateKnowledge(records){
 return validatePersonaPackage({id:"knowledge-import",version:1,name:{en:"Import",zh:"导入"},venue:{en:"Museum",zh:"博物馆"},role:{en:"Museum guide",zh:"博物馆导览"},tone:"professional",greeting:{en:"Hello",zh:"您好"},scope:["Museum"],knowledge:records}).knowledge;
}
export function parseKnowledgeFile(path,content){
 knowledgePath(path);
 if(typeof content!=="string"||Buffer.byteLength(content)>2097152)throw new PersonaError("File exceeds 2 MB",413);
 if(/[.]json$/i.test(path)){
  let data;try{data=JSON.parse(content);}catch{throw new PersonaError("The knowledge JSON is invalid");}
  // Import knowledge only. A linked package cannot replace identity or policies.
  return validateKnowledge(Array.isArray(data)?data:data?.knowledge);
 }
 if(!content.trim()||content.length>12000||!attachmentTextSafe(content))throw new PersonaError("Text must be safe museum content, at most 12,000 characters");
 const hash=createHash("sha256").update(path).digest("hex").slice(0,16);
 const chunks=Array.from({length:Math.ceil(content.length/1300)},(_,i)=>content.slice(i*1300,(i+1)*1300).trim()).filter(Boolean);
 return validateKnowledge(chunks.map((text,i)=>({id:"SRC_"+hash+"_"+(i+1),question_en:path+" — source excerpt "+(i+1),question_zh:path+" — 原文片段 "+(i+1),answer_en:text,answer_zh:text,sources:[]})));
}
export function knowledgeStorage(env=process.env,fetchImpl=fetch){
 if(!env.SUPABASE_SERVICE_ROLE_KEY)throw new PersonaError("Knowledge storage is not configured",503);
 const project=connectionLink(env.SUPABASE_URL,env).project;
 return createClient(project,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(url,init={})=>{
  const target=new URL(url);
  if(target.origin!==project||!target.pathname.startsWith("/storage/v1/"))throw new PersonaError("Invalid storage destination");
  const response=await fetchImpl(url,{...init,redirect:"error",signal:AbortSignal.timeout(10000)});
  if(!response.body)return response;
  const reader=response.body.getReader();const chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2097152){await reader.cancel();throw new PersonaError("Storage response exceeds 2 MB",413);}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
  return new Response(Buffer.concat(chunks),{status:response.status,headers:response.headers});
 }}}).storage;
}
export async function ensureKnowledgeBucket(storage,create=false){
 let {data,error}=await storage.getBucket(KNOWLEDGE_BUCKET);
 const status=String(error?.status??error?.statusCode);
 // Storage also uses 400 for its explicit "Bucket not found" response.
 const missing=status==="404"||(status==="400"&&/^bucket not found$/i.test(error?.message||""));
 if(error&&create&&missing){
  const made=await storage.createBucket(KNOWLEDGE_BUCKET,{public:false,fileSizeLimit:2097152,allowedMimeTypes:["application/json","text/plain","text/markdown"]});
  if(made.error)throw new PersonaError("Could not create the private knowledge bucket",503);
  ({data,error}=await storage.getBucket(KNOWLEDGE_BUCKET));
 }
 if(error||!data)throw new PersonaError("Connect first to initialize the dedicated knowledge bucket",503);
 if(data.public!==false)throw new PersonaError("The knowledge bucket must be private; ask the project owner to correct its visibility",503);
}

