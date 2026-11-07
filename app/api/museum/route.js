import { DESHOU_PERSONA } from '../../../data/personas/deshou-palace.js';
import { exhibits, MUSEUM_GUIDE_ID } from '../../../lib/museum-guide.js';
import { resolvePersona, personaErrorResponse } from '../../../lib/personas/index.js';

export async function GET() {
  try {
    const persona = await resolvePersona(MUSEUM_GUIDE_ID);
    if (!persona) return Response.json({ error: 'Museum guide unavailable' }, { status: 404 });
    const records = exhibits.flatMap(exhibit => {
      const original = DESHOU_PERSONA.knowledge.find(record => record.id === exhibit.id);
      const published = persona.knowledge.find(record => record.id === exhibit.id);
      // Curated display metadata belongs to the original object, even if an ID is reused.
      if (!published || !original || published.question_en !== original.question_en || published.question_zh !== original.question_zh) return [];
      return [{ ...exhibit, description: { en: published.answer_en, zh: published.answer_zh },
        question: { en: published.question_en, zh: published.question_zh }, sources: published.sources }];
    });
    return Response.json({ records, version: persona.version }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return personaErrorResponse(error); }
}
