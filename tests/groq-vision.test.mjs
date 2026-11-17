import test from 'node:test';
import assert from 'node:assert/strict';
import { DESHOU_PERSONA } from '../data/personas/deshou-palace.js';
import { answerAttachment, attachmentTextSafe } from '../lib/attachments/analyze.js';
import { identifyMuseumArtifact } from '../lib/attachments/museum.js';
import { redactSensitiveText } from '../lib/ai/input-normalization.js';
import { parseGeneratedAnswer } from '../lib/ai/answer.js';

const groq = 'https://api.groq.com/openai/v1';
const env = {
  AI_BASE_URL: groq,
  AI_API_KEY: 'synthetic-text-key',
  AI_MODEL: 'openai/gpt-oss-20b',
  AI_API_STYLE: 'chat_completions',
  GROQ_VISION_API_KEY: 'synthetic-image-key',
  SUB2API_API_KEY: 'old-text-key',
  AI_IMAGE_IDENTIFICATION_PROVIDER: 'gemini_free',
  AI_IMAGE_IDENTIFICATION_MODEL: 'gemini-3.6-flash',
  GEMINI_API_KEY: 'old-gemini-key',
  AI_VISION_MODEL: 'google/old-vision'
};
const attachment = { kind: 'image', bytes: Buffer.from('fixture') };
const completion = value => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] });
const museum = (fetchImpl, overrides = {}) => identifyMuseumArtifact({
  attachment, message: 'What artifact is this?', persona: DESHOU_PERSONA, env, fetchImpl, ...overrides
});
const assertVisionRequest = (url, init) => {
  assert.equal(url, `${groq}/chat/completions`);
  assert.equal(init.headers.Authorization, 'Bearer synthetic-image-key');
  const body = JSON.parse(init.body);
  assert.equal(body.model, 'qwen/qwen3.8-27b');
  assert.deepEqual(body.response_format, { type: 'json_object' });
  assert.equal(body.messages[1].content[1].image_url.url, 'data:image/jpeg;base64,Zml4dHVyZQ==');
};

test('museum images use Groq even when legacy Gemini settings remain and only verified records are rendered', async () => {
  let calls = 0;
  const result = await museum((url, init) => {
    calls++;
    assertVisionRequest(url, init);
    assert.doesNotMatch(init.body, /DS005|gov.cn/);
    return completion({ decision: 'identified', confidence: 'high', name_en: 'Hexagonal seven-tube flower vessel', name_zh: '龙泉窑青釉六方七管占景盆' });
  }, { env: { ...env, AI_BASE_URL: 'https://unused-gateway.invalid/v1' } });
  assert.equal(calls, 1);
  assert.equal(result.mode, 'museum_identity_match');
  assert.deepEqual(result.recordIds, ['DS005']);
});

test('a Groq museum vision failure or missing credential never falls back to Gemini or the text key', async () => {
  let calls = 0;
  const quota = await museum((url, init) => {
    calls++;
    assertVisionRequest(url, init);
    return new Response(null, { status: 429 });
  });
  const missing = await museum(() => { calls++; }, { env: { ...env, GROQ_VISION_API_KEY: '' } });
  assert.equal(calls, 1);
  assert.equal(quota.mode, 'museum_attachment_unavailable');
  assert.equal(missing.mode, 'museum_attachment_unavailable');
});

test('a conflicting tube count or object type cannot produce a catalogue match', async () => {
  for (const [name_en, name_zh] of [
    ['Hexagonal flower vessel with eight tubes', '六方八管花插'],
    ['Hexagonal ceramic censer with seven tubes', '六方七管香炉']
  ]) {
    const result = await museum(() => completion({ decision: 'identified', confidence: 'high', name_en, name_zh }));
    assert.equal(result.mode, 'museum_identity_not_found');
    assert.equal(result.recordIds, undefined);
  }
});

test('travel image requests send bytes to the vision key and validated observations to the separate text key', async () => {
  let calls = 0;
  const result = await answerAttachment({ attachment, message: 'Where is this place in China?', env, fetchImpl: (url, init) => {
    calls++;
    if (calls === 1) {
      assertVisionRequest(url, init);
      return completion({ kind: 'landmark', country: 'CN', confidence: 'high', place: 'West Lake', city: 'Hangzhou', description: 'Public lake in Hangzhou.', text: '' });
    }
    assert.equal(url, `${groq}/chat/completions`);
    assert.equal(init.headers.Authorization, 'Bearer synthetic-text-key');
    assert.equal(JSON.parse(init.body).model, env.AI_MODEL);
    assert.match(init.body, /Public lake in Hangzhou/);
    assert.doesNotMatch(init.body, /base64|image_url/);
    return completion({ decision: 'answer', reply: 'You can visit West Lake in Hangzhou.', recordIds: ['ATTACHMENT'] });
  } });
  assert.equal(calls, 2);
  assert.equal(result.mode, 'attachment_answer');
});

test('Groq mode does not submit a PDF to the text or photo endpoints', async () => {
  let calls = 0;
  const pdf = { kind: 'pdf', bytes: Buffer.from('pdf fixture') };
  const fetchImpl = () => { calls++; };
  const travel = await answerAttachment({ attachment: pdf, message: 'Read this China travel guide', env, fetchImpl });
  const artifact = await museum(fetchImpl, { attachment: pdf });
  assert.equal(calls, 0);
  assert.match(travel.reply, /PDF reading is unavailable/);
  assert.match(artifact.reply, /PDF reading is unavailable/);
});

test('Groq credentials are redacted from model input, blocked in attachments, and rejected in replies', () => {
  const canary = 'gsk_SYNTHETIC_FIXTURE12345678';
  assert.equal(redactSensitiveText(canary), '[REDACTED_SECRET]');
  assert.equal(attachmentTextSafe(canary), false);
  for (const credential of [canary, env.GROQ_VISION_API_KEY]) {
    const reply = JSON.stringify({ decision: 'answer', reply: `Credential ${credential}`, recordIds: [] });
    assert.throws(() => parseGeneratedAnswer(reply, [], { env }), /Unsafe generated answer/);
  }
});
