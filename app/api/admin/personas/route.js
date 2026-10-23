import { authorizePersonaAdmin, listPersonas, publishPersona, readPersonaRequest, personaErrorResponse, PersonaError } from "../../../../lib/personas/index.js";

export const runtime = "nodejs";

function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) throw new PersonaError("Cross-origin administration is not allowed", 403);
}

export async function GET(request) {
  try {
    sameOrigin(request);
    await authorizePersonaAdmin(request);
    return Response.json({ personas: await listPersonas() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return personaErrorResponse(error); }
}

export async function POST(request) {
  try {
    sameOrigin(request);
    const actor = await authorizePersonaAdmin(request);
    const profile = await publishPersona(await readPersonaRequest(request), actor.id);
    return Response.json({ persona: profile }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return personaErrorResponse(error); }
}
