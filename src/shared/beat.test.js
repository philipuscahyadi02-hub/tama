// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const { createBeatTracker, estimatePeriod, fold } = require('./beat');

/** Simulate a kick drum at `bpm` for `seconds`, sampled every 20 ms, with some noise and an optional offbeat. */
function run(bpm, seconds, { offbeat = false, noise = 0.04 } = {}) {
  const tr = createBeatTracker();
  const period = 60 / bpm;
  /** @type {number[]} */ const beats = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let t = 0; t < seconds; t += 0.02) {
    const ph = (t % period) / period;
    let e = 0.15 + rnd() * noise;
    if (ph < 0.08) e = 0.85;                               // kick
    if (offbeat && Math.abs(ph - 0.5) < 0.04) e = Math.max(e, 0.45); // hi-hat/offbeat, weaker
    const r = tr.feed(e, t);
    if (r.beat) beats.push(t);
  }
  return { tr, beats, period };
}

test('fold keeps tempos in 70–180 BPM', () => {
  assert.equal(fold(0.25), 0.5);   // 240 BPM → 120
  assert.equal(fold(1.2), 0.6);    // 50 BPM → 100
  assert.equal(fold(0.5), 0.5);
  assert.equal(fold(0), 0);
});

test('estimatePeriod finds the gap between regular onsets', () => {
  const on = [0, 0.5, 1, 1.5, 2, 2.5, 3];
  assert.ok(Math.abs(estimatePeriod(on) - 0.5) <= 0.01);
  assert.equal(estimatePeriod([0, 0.5]), 0, 'too few onsets');
});

test('tracks 120 BPM and its beats land on the kicks', () => {
  const { tr, beats, period } = run(120, 12);
  assert.ok(Math.abs(tr.bpm() - 120) <= 3, `bpm ${tr.bpm()}`);
  const late = beats.filter((t) => t > 6);
  assert.ok(late.length >= 10, `beats ${late.length}`);
  const phases = late.map((t) => { const ph = (t % period) / period; return ph > 0.5 ? ph - 1 : ph; });
  const avg = phases.reduce((a, b) => a + Math.abs(b), 0) / phases.length;
  assert.ok(avg < 0.15, `beats are off the kick by ${avg.toFixed(2)} of a beat`);
});

test('other tempos, with an offbeat hi-hat', () => {
  for (const bpm of [90, 128, 150]) {
    const { tr } = run(bpm, 14, { offbeat: true });
    assert.ok(Math.abs(tr.bpm() - bpm) <= 4, `${bpm} BPM read as ${tr.bpm()}`);
  }
});

test('silence gives no beats', () => {
  const tr = createBeatTracker();
  let beats = 0;
  for (let t = 0; t < 6; t += 0.02) if (tr.feed(0.001, t).beat) beats += 1;
  assert.equal(beats, 0);
});
