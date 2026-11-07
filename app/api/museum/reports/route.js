import { createHmac } from 'node:crypto';
import { analyticsBucket } from '../../../../lib/admin/analytics.js';
import { authenticate } from '../../../../lib/db/supabase.js';
import { exhibits, reportReasons } from '../../../../lib/museum-guide.js';
import { authorizePersonaAdmin, PersonaError, personaErrorResponse } from '../../../../lib/personas/index.js';

const folder = date => `museum-feedback/${date.toISOString().slice(0, 10)}`;
const headers = { 'Cache-Control': 'no-store' };
const exhibitIds = new Set(exhibits.map(exhibit => exhibit.id));
const perDayLimit = 100;

export async function POST(request) {
  try {
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) throw new PersonaError('Cross-origin reporting is not allowed', 403);
    const token = /^Bearer ([^\s]{1,8192})$/.exec(request.headers.get('Authorization') || '')?.[1];
    if (!token) throw new PersonaError('Sign in to report an exhibit', 401);
    const user = await authenticate(token);
    if (!user) throw new PersonaError('Sign in again to report an exhibit', 401);
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) throw new PersonaError('Use application/json', 415);
    if (!request.body) throw new PersonaError('Report is required');
    const reader = request.body.getReader();
    let size = 0;
    const chunks = [];
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 512) { await reader.cancel(); throw new PersonaError('Report is too large', 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new PersonaError('Invalid report'); }
    if (!body || Object.keys(body).length !== 2 || !exhibitIds.has(body.artifactId) || !reportReasons.includes(body.reason)) {
      throw new PersonaError('Invalid exhibit or issue type');
    }
    const { artifactId, reason } = body;
    const prefix = folder(new Date());
    // This opaque digest deduplicates daily reports without storing visitor account IDs.
    const digest = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY)
      .update(JSON.stringify([user.id, prefix, artifactId, reason])).digest('hex').slice(0, 32);
    const files = await analyticsBucket();
    const { error } = await files.upload(`${prefix}/${artifactId}-${reason}-${digest}.json`,
      JSON.stringify({ artifactId, reason }), { contentType: 'application/json', upsert: false });
    if (error && String(error.status ?? error.statusCode) !== '409' && !/^the resource already exists\.?$/i.test(error.message || '')) {
      throw new PersonaError('Exhibit reports are temporarily unavailable', 503);
    }
    return Response.json({ received: true }, { status: 202, headers });
  } catch (error) { return personaErrorResponse(error); }
}

export async function GET(request) {
  try {
    await authorizePersonaAdmin(request);
    const files = await analyticsBucket();
    const now = Date.now();
    const days = await Promise.all(Array.from({ length: 7 }, (_, offset) =>
      files.list(folder(new Date(now - offset * 86400000)), {
        limit: perDayLimit, sortBy: { column: 'created_at', order: 'desc' }
      })));
    if (days.some(day => day.error)) throw new PersonaError('Exhibit reports are temporarily unavailable', 503);
    const reports = days.flatMap(day => (day.data || []).flatMap(file => {
      const [, artifactId, reason] = /^(DS\d{3})-(\w+)-[a-f0-9]{32}\.json$/.exec(file.name) || [];
      if (!exhibitIds.has(artifactId) || !reportReasons.includes(reason) || !Number.isFinite(Date.parse(file.created_at))) return [];
      return [{ artifactId, reason, receivedAt: file.created_at }];
    }));
    return Response.json({ reports, limited: days.some(day => day.data?.length === perDayLimit) }, { headers });
  } catch (error) { return personaErrorResponse(error); }
}
