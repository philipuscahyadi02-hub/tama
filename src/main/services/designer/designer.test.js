// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDesigner } = require('.');
const fallback = require('./fallback');
const { Bus } = require('../../bus');

test('keyword designer: reads animal, hair/eye colors, outfit and traits', () => {
  const [v1] = fallback.designFromText({ gender: 'boy', prompt: 'a sleepy cat boy with silver hair and blue eyes in a hoodie' });
  assert.equal(v1.parts.headwear, 'cat-ears');
  assert.equal(v1.parts.outfit, 'hoodie');
  assert.equal(v1.parts.eyes, 'sleepy');
  assert.equal(v1.palette.hair, '#c8cdd8');
  assert.equal(v1.palette.eyes, '#5b9cff');
  assert.ok(v1.speech.tics.includes('nya~'));
  assert.ok(v1.personality.energy <= 35);
  assert.equal(v1.pronouns.subject, 'he');
});

test('keyword designer: 3 variants, deterministic for the same input', () => {
  const a = fallback.designFromText({ gender: 'girl', prompt: 'bunny girl' });
  const b = fallback.designFromText({ gender: 'girl', prompt: 'bunny girl' });
  assert.equal(a.length, 3);
  assert.deepEqual(a, b);
  assert.ok(a.every((v) => v.parts.headwear === 'bunny-hood'));
});

test('keyword refine: changes only what was asked', () => {
  const [base] = fallback.designFromText({ gender: 'girl', prompt: 'fox girl with orange hair', name: 'Kiki' });
  const [changed] = fallback.refineFromText({ spec: base, instruction: 'make the hair blue and add glasses' });
  assert.equal(changed.palette.hair, '#5b9cff');
  assert.ok(changed.parts.accessories.includes('round-glasses'));
  assert.equal(changed.parts.headwear, 'fox-ears');
  assert.equal(changed.name, 'Kiki');
});

test('voice: keywords map to pitch/rate within range', () => {
  const v = fallback.voiceFromText({ voicePrompt: 'deep, slow and calm', gender: 'boy' });
  assert.ok(v.pitch < 1 && v.rate < 1);
  assert.equal(v.voiceGender, 'male');
});

test('designer: AI reply is normalized (gender + prompt forced, junk dropped)', async () => {
  const askJson = async () => ({ variants: [
    { name: 'Neko', gender: 'boy', parts: { headwear: 'cat-ears', outfit: 'tuxedo' }, palette: { hair: '#000000' } },
    { name: 'B' }, { name: 'C' }, { name: 'extra' },
  ] });
  const d = createDesigner({ bus: new Bus(), askJson });
  const r = await d.generate({ gender: 'girl', prompt: 'cat' });
  assert.equal(r.source, 'ai');
  assert.equal(r.variants.length, 3);
  assert.equal(r.variants[0].gender, 'girl');           // the user's choice wins over the model's
  assert.equal(r.variants[0].parts.outfit, 'cardigan-skirt'); // unknown part → default
  assert.equal(r.variants[0].designPrompt, 'cat');
});

test('designer: model failure falls back to keywords with a warning', async () => {
  const d = createDesigner({ bus: new Bus(), askJson: async () => { throw new Error('not logged in'); } });
  const r = await d.generate({ gender: 'girl', prompt: 'frog girl' });
  assert.equal(r.source, 'offline');
  assert.match(r.warning || '', /unavailable/);
  assert.equal(r.variants[0].parts.headwear, 'frog-hood');
});

test('designer: refine keeps gender, prompt and voice from the base spec', async () => {
  const d = createDesigner({ bus: new Bus(), askJson: async () => ({ variants: [{ name: 'X', gender: 'boy', voice: { pitch: 0.5 } }] }) });
  const [base] = fallback.designFromText({ gender: 'nonbinary', prompt: 'bear', name: 'Kuma' });
  const r = await d.refine({ spec: { ...base, voice: { ...base.voice, pitch: 1.7 } }, instruction: 'more pink' });
  assert.equal(r.variants[0].gender, 'nonbinary');
  assert.equal(r.variants[0].voice.pitch, 1.7);
  assert.equal(r.variants[0].designPrompt, 'bear');
});

test('designer: bus handlers are registered', async () => {
  const bus = new Bus();
  createDesigner({ bus }).start();
  const r = await bus.request('designer.voice', { voicePrompt: 'squeaky and fast', gender: 'girl' });
  assert.ok(r.voice.pitch > 1.3);
  assert.equal(r.source, 'offline');
});

test('keyword colors: longest name wins ("sky blue" is not "blue")', () => {
  const [v] = fallback.designFromText({ gender: 'girl', prompt: 'girl with sky blue hair' });
  assert.equal(v.palette.hair, '#8cc8ff');
});

test('keyword designer: suggested names differ between variants', () => {
  const v = fallback.designFromText({ gender: 'boy', prompt: 'a sleepy cat boy with headphones who loves coffee' });
  assert.equal(new Set(v.map((x) => x.name)).size, 3);
});
