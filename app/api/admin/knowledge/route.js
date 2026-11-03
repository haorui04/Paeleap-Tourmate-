import {authorizePersonaAdmin,readPersonaRequest,resolvePersona,PersonaError,personaErrorResponse} from "../../../../lib/personas/index.js";
import {connectionLink,knowledgePath,knowledgeStorage,ensureKnowledgeBucket,parseKnowledgeFile,KNOWLEDGE_BUCKET} from "../../../../lib/admin/knowledge-source.js";
export const runtime="nodejs";
export const maxDuration=60;
async function guard(request){
 const origin=request.headers.get("Origin");if(origin&&origin!==new URL(request.url).origin)throw new PersonaError("Cross-origin administration is not allowed",403);
 return authorizePersonaAdmin(request);
}
export async function GET(request){
 try{await guard(request);return Response.json({projectUrl:connectionLink(process.env.SUPABASE_URL).project,bucket:KNOWLEDGE_BUCKET},{headers:{"Cache-Control":"no-store"}});}
 catch(error){return personaErrorResponse(error);}
}
export async function POST(request){
 try{
  await guard(request);
  const input=await readPersonaRequest(request);
  if(!input||Array.isArray(input)||Object.keys(input).some(k=>!["action","link","path","personaId","content"].includes(k)))throw new PersonaError("Invalid knowledge request");
  if(!["database","connect","upload","preview"].includes(input.action))throw new PersonaError("Invalid knowledge action");
  const source=connectionLink(input.link);
  if(input.action==="database"){
   if(!input.personaId||input.personaId==="tourmate")throw new PersonaError("Select a published museum profile");
   const persona=await resolvePersona(input.personaId);if(!persona)throw new PersonaError("Published museum not found",404);
   return Response.json({knowledge:persona.knowledge,source:{type:"database",name:persona.id,version:persona.version},notice:"Review before publishing"},{headers:{"Cache-Control":"no-store"}});
  }
  const storage=knowledgeStorage();
  await ensureKnowledgeBucket(storage,input.action==="connect");
  if(input.action==="connect"){
   const {data,error}=await storage.from(KNOWLEDGE_BUCKET).list("",{limit:100,sortBy:{column:"name",order:"asc"}});
   if(error)throw new PersonaError("Could not list knowledge files",503);
   return Response.json({projectUrl:source.project,bucket:KNOWLEDGE_BUCKET,files:(data||[]).filter(f=>f.id&&/[.](json|txt|md)$/i.test(f.name)).map(f=>({name:f.name,size:f.metadata?.size})),directPath:source.path},{headers:{"Cache-Control":"no-store"}});
  }
  const path=knowledgePath(input.path||source.path);
  if(input.action==="upload"){
   const knowledge=parseKnowledgeFile(path,input.content);
   // Re-serialize validated knowledge, not executable archives or raw commands.
   const target=path.replace(/[.](txt|md)$/i,".json");
   const {error}=await storage.from(KNOWLEDGE_BUCKET).upload(target,JSON.stringify({knowledge}),{contentType:"application/json",upsert:false});
   if(error)throw new PersonaError("Upload failed. Choose a new filename if it already exists.",409);
   return Response.json({path:target,records:knowledge.length},{status:201,headers:{"Cache-Control":"no-store"}});
  }
  if(input.action!=="preview")throw new PersonaError("Invalid knowledge action");
  const {data,error}=await storage.from(KNOWLEDGE_BUCKET).download(path);
  if(error||!data)throw new PersonaError("Knowledge file is unavailable",404);
  const knowledge=parseKnowledgeFile(path,await data.text());
  return Response.json({knowledge,source:{type:"file",name:path},notice:"Original-language text is not automatically translated. Review before publishing."},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return personaErrorResponse(error);}
}

