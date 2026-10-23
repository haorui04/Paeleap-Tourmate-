import { listPublicPersonas, resolvePersona, publicPersona, personaErrorResponse } from "../../../lib/personas/index.js";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id !== null) {
      const profile = await resolvePersona(id);
      if (!profile) return Response.json({ error: { code: "persona_not_found", message: "Persona not found" } }, { status: 404 });
      return Response.json({ persona: publicPersona(profile) }, { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ personas: await listPublicPersonas() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return personaErrorResponse(error); }
}
