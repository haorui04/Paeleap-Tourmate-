import {authorizePersonaAdmin,resolvePersona,PersonaError,personaErrorResponse} from '../../../../lib/personas/index.js';
import {readAnalytics} from '../../../../lib/admin/analytics.js';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request){
 try{
  const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)throw new PersonaError('Cross-origin administration is not allowed',403);
  await authorizePersonaAdmin(request);
  const q=new URL(request.url).searchParams;
  if([...q.keys()].some(k=>!['personaId','from','to','traffic'].includes(k))||[...new Set(q.keys())].some(k=>q.getAll(k).length!==1))throw new PersonaError('Invalid dashboard filters');
  const persona=await resolvePersona(q.get('personaId'));if(!persona||persona.id==='tourmate')throw new PersonaError('Select a published museum',404);
  const traffic=q.get('traffic')||'visitor';const dashboard=await readAnalytics(persona.id,q.get('from'),q.get('to'),traffic);
  return Response.json({...dashboard,traffic},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch(error){return personaErrorResponse(error);}
}
