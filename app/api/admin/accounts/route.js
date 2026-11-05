import {authorizePersonaAdmin,readPersonaRequest,PersonaError,personaErrorResponse} from '../../../../lib/personas/index.js';
import {accountDirectory,userUsage,securityReview,sendRecovery} from '../../../../lib/admin/accounts.js';
export const runtime='nodejs';export const maxDuration=60;
async function guard(request){const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)throw new PersonaError('Cross-origin administration is not allowed',403);return authorizePersonaAdmin(request);}
export async function GET(request){try{await guard(request);const q=new URL(request.url).searchParams;if([...q.keys()].some(k=>!['view','userId'].includes(k))||[...q.keys()].some(k=>q.getAll(k).length!==1))throw new PersonaError('Invalid account filters');
 const view=q.get('view')||'directory';let data;
 if(view==='usage')data=await userUsage(q.get('userId'));else if(view==='security')data=await securityReview();else if(['summary','directory'].includes(view)){data=await accountDirectory();if(view==='summary'){const {users,...summary}=data;data=summary;}}else throw new PersonaError('Invalid account view');
 return Response.json(data,{headers:{'Cache-Control':'no-store'}});
}catch(error){return personaErrorResponse(error);}}
export async function POST(request){try{const actor=await guard(request);const body=await readPersonaRequest(request);if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['action','userId'].includes(k))||body.action!=='send_recovery')throw new PersonaError('Invalid account action');return Response.json(await sendRecovery(body.userId,actor.id,new URL(request.url).origin),{headers:{'Cache-Control':'no-store'}});}catch(error){return personaErrorResponse(error);}}
