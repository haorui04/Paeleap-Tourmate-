import {authorizePersonaAdmin,personaVersionHistory,resolvePersona,PersonaError,personaErrorResponse} from "../../../../../lib/personas/index.js";
export const runtime="nodejs";
export async function GET(request){
  try{
    const url=new URL(request.url);
    if(request.headers.get("Origin")&&request.headers.get("Origin")!==url.origin)throw new PersonaError("Cross-origin administration is not allowed",403);
    await authorizePersonaAdmin(request);
    const id=url.searchParams.get("personaId");
    const raw=url.searchParams.get("version");
    if(raw!==null&&(!/^[1-9][0-9]{0,9}$/.test(raw)||Number(raw)>2147483647))throw new PersonaError("Invalid version");
    const versions=await personaVersionHistory(id);
    const persona=await resolvePersona(id,process.env,raw===null?undefined:Number(raw));
    if(!persona)throw new PersonaError("Persona version not found",404);
    return Response.json({persona,versions},{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  }catch(error){return personaErrorResponse(error);}
}
