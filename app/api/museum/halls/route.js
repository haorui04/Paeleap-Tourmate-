import { MUSEUM_GUIDE_ID } from '../../../../lib/museum-guide.js';
import { resolvePersona, personaErrorResponse } from '../../../../lib/personas/index.js';
import { getGroupedArtifactCatalogue } from '../../../../lib/db/deshou-artifacts.js';
export async function GET() {
 try {
  const persona=await resolvePersona(MUSEUM_GUIDE_ID);
  if(!persona)return Response.json({error:'Museum guide unavailable'},{status:404});
  const catalogue=await getGroupedArtifactCatalogue();
  return Response.json({...catalogue,version:persona.version},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return personaErrorResponse(error);}
}
