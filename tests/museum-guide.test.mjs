import assert from 'node:assert/strict';
import test from 'node:test';
import { GET as catalogue } from '../app/api/museum/route.js';
import { GET as reports, POST as report } from '../app/api/museum/reports/route.js';
import { DESHOU_PERSONA } from '../data/personas/deshou-palace.js';
import { speechPages } from '../lib/museum-guide.js';

const admin = '550e8400-e29b-41d4-a716-446655440000';
const visitor = '550e8400-e29b-41d4-a716-446655440001';
const env = { SUPABASE_URL: 'https://fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service-role',
  SUPABASE_PUBLISHABLE_KEY: 'fixture-public', PERSONA_ADMIN_USER_IDS: admin };
const base = 'https://guide.example.org/api/museum/reports';

function fixture(t, fetch) {
  const before = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.mock.method(globalThis, 'fetch', fetch);
  t.after(() => {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test('museum catalogue returns published descriptions but excludes reused exhibit IDs and private persona fields', async t => {
  const published = structuredClone(DESHOU_PERSONA);
  published.knowledge.find(item => item.id === 'DS005').question_en = 'What is another exhibit?';
  published.knowledge.find(item => item.id === 'DS014').answer_en = 'An excavated beast-mask eaves tile.';
  fixture(t, async url => {
    assert.equal(new URL(url).pathname, '/rest/v1/persona_packages');
    return Response.json([{ payload: published }]);
  });
  const response = await catalogue();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.records.find(item => item.id === 'DS014').description.en, 'An excavated beast-mask eaves tile.');
  assert.equal(body.records.some(item => item.id === 'DS005'), false);
  assert.deepEqual(Object.keys(body).sort(), ['records', 'version']);
});

test('tour narration breaks verified text into English and Chinese pages', () => {
  assert.deepEqual(speechPages('First sentence. Second sentence!'), ['First sentence.', 'Second sentence!']);
  assert.deepEqual(speechPages('第一句。第二句！'), ['第一句。', '第二句！']);
});

test('exhibit reports require visitor authentication and administrator access to read', async t => {
  fixture(t, async () => Response.json({ id: visitor }));
  assert.equal((await report(new Request(base, { method: 'POST' }))).status, 401);
  assert.equal((await reports(new Request(base, { headers: { Authorization: 'Bearer visitor' } }))).status, 403);
  assert.equal((await report(new Request(base, {
    method: 'POST', headers: { Origin: 'https://other.example.org', Authorization: 'Bearer visitor' }
  }))).status, 403);
});

test('repeat structured reports use the same private object without storing the account ID', async t => {
  const uploads = [];
  fixture(t, async (url, init) => {
    const { pathname } = new URL(url);
    if (pathname === '/auth/v1/user') return Response.json({ id: visitor });
    if (pathname === '/storage/v1/bucket/tourmate-analytics') return Response.json({ id: 'tourmate-analytics', public: false });
    assert.match(pathname, /^\/storage\/v1\/object\/tourmate-analytics\/museum-feedback\/\d{4}-\d{2}-\d{2}\/DS014-match-[a-f0-9]{32}\.json$/);
    uploads.push(pathname);
    assert.equal(typeof init.body, 'string');
    assert.deepEqual(JSON.parse(init.body), { artifactId: 'DS014', reason: 'match' });
    return uploads.length === 1 ? Response.json({ Key: pathname }) : Response.json({ message: 'The resource already exists' }, { status: 409 });
  });
  const send = body => report(new Request(base, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer visitor' }, body: JSON.stringify(body) }));
  assert.equal((await send({ artifactId: 'DS014', reason: 'match', freeText: 'private' })).status, 400);
  assert.equal((await send({ artifactId: 'DS014', reason: 'match' })).status, 202);
  assert.equal((await send({ artifactId: 'DS014', reason: 'match' })).status, 202);
  assert.equal(uploads.length, 2);
  assert.equal(uploads[0], uploads[1]);
});
