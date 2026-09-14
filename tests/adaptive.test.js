import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  updateFact, fluency, status, effective, speedScore, selectTraining, summarize,
  tableSummary, isTableFluent, weakest, priority, interleave, FACT_KEYS, factKey, reverseKey,
} from '../js/adaptive.js';
import { seededRandom, DAY_MS } from '../js/util.js';

const NOW = Date.parse('2026-09-14T10:00:00Z');

function drill(facts, key, answers, at = NOW) {
  for (const [correct, ms] of answers) facts[key] = updateFact(facts[key], { correct, ms, at });
  return facts;
}

test('speedScore is 1 when fast, 0 when slow, linear between', () => {
  assert.equal(speedScore(1000), 1);
  assert.equal(speedScore(2500), 1);
  assert.equal(speedScore(6000), 0);
  assert.equal(speedScore(null), 0);
  assert.ok(Math.abs(speedScore(4250) - 0.5) < 1e-9);
});

test('a fact is unknown until two attempts, then reflects accuracy and speed', () => {
  const facts = {};
  drill(facts, '7x8', [[true, 2000]]);
  assert.equal(status(facts['7x8']), 'unknown');
  assert.equal(fluency(facts['7x8']), null);
  drill(facts, '7x8', [[true, 2000], [true, 2000]]);
  assert.equal(status(facts['7x8']), 'fluent');
  assert.equal(facts['7x8'].stage, 3);
});

test('wrong answers drop the stage and the status', () => {
  const facts = {};
  drill(facts, '6x7', [[true, 2000], [true, 2000], [true, 2000]]);
  assert.equal(status(facts['6x7']), 'fluent');
  drill(facts, '6x7', [[false, null]]);
  assert.equal(facts['6x7'].stage, 0);
  assert.notEqual(status(facts['6x7']), 'fluent');
  assert.equal(facts['6x7'].last3.length, 3);
});

test('slow correct answers give a "nearly" rather than fluent status', () => {
  const facts = {};
  drill(facts, '9x6', [[true, 5500], [true, 5500], [true, 5500]]);
  assert.equal(status(facts['9x6']), 'nearly');
});

test('effective status falls back to the reversed fact but never to fluent', () => {
  const facts = {};
  drill(facts, '7x8', [[true, 2000], [true, 2000], [true, 2000]]);
  const e = effective(facts, '8x7');
  assert.equal(e.derived, true);
  assert.equal(e.status, 'nearly');
  assert.equal(effective(facts, '3x4').status, 'unknown');
});

test('selectTraining on an empty profile picks unseen facts, no duplicates or reversals', () => {
  const round = selectTraining({}, 15, { now: NOW, rng: seededRandom(1) });
  assert.equal(round.length, 15);
  const keys = new Set(round.map((q) => q.key));
  assert.equal(keys.size, 15);
  for (const q of round) assert.ok(!keys.has(reverseKey(q.key)) || q.a === q.b, `reversal ${q.key}`);
  for (const q of round) assert.ok(q.a >= 2 && q.a <= 12 && q.b >= 2 && q.b <= 12);
});

test('selectTraining prefers the facts a child got wrong', () => {
  const facts = {};
  for (const key of FACT_KEYS) drill(facts, key, [[true, 2000], [true, 2000], [true, 2000]], NOW - 20 * DAY_MS);
  drill(facts, '7x8', [[false, null], [false, null]]);
  drill(facts, '9x12', [[false, null], [false, null]]);
  const round = selectTraining(facts, 10, { now: NOW, rng: seededRandom(3) });
  const keys = round.map((q) => q.key);
  assert.ok(keys.includes('7x8'));
  assert.ok(keys.includes('9x12'));
});

test('unseen facts outrank everything, then derived, then weak, then fluent', () => {
  const facts = {};
  drill(facts, '7x8', [[true, 2000], [true, 2000], [true, 2000]]);
  drill(facts, '6x9', [[false, null], [false, null]]);
  assert.ok(priority(facts, '3x4', NOW) > priority(facts, '8x7', NOW));
  assert.ok(priority(facts, '8x7', NOW) > priority(facts, '7x8', NOW));
  assert.ok(priority(facts, '6x9', NOW) > priority(facts, '7x8', NOW));
});

test('due fluent facts are more likely to be reviewed than fresh ones', () => {
  const facts = {};
  drill(facts, '7x8', [[true, 2000], [true, 2000], [true, 2000]], NOW - 30 * DAY_MS);
  drill(facts, '6x6', [[true, 2000], [true, 2000], [true, 2000]], NOW);
  assert.ok(priority(facts, '7x8', NOW) > priority(facts, '6x6', NOW));
});

test('filter restricts a round to one times table and allows reversals when the pool is small', () => {
  const round = selectTraining({}, 15, { now: NOW, rng: seededRandom(5), filter: ({ a, b }) => a === 7 || b === 7 });
  assert.equal(round.length, 15);
  for (const q of round) assert.ok(q.a === 7 || q.b === 7);
});

test('interleave never puts three questions sharing a factor in a row when avoidable', () => {
  const items = [];
  for (const a of [2, 3, 4, 5, 6]) for (const b of [7, 8, 9]) items.push({ a, b });
  const out = interleave(items, seededRandom(9));
  for (let i = 2; i < out.length; i++) {
    const [x, y, z] = [out[i - 2], out[i - 1], out[i]];
    const common = [x.a, x.b].filter((f) => [y.a, y.b].includes(f) && [z.a, z.b].includes(f));
    assert.equal(common.length, 0, `triple at ${i}`);
  }
});

test('summarize and tableSummary count statuses and explored pairs', () => {
  const facts = {};
  const s0 = summarize(facts);
  assert.equal(s0.unknown, 121);
  assert.equal(s0.exploredPairs, 0);
  drill(facts, '7x8', [[true, 2000], [true, 2000], [true, 2000]]);
  const s1 = summarize(facts);
  assert.equal(s1.fluent, 1);
  assert.equal(s1.nearly, 1); // 8x7 derived
  assert.equal(s1.exploredPairs, 1);
  assert.equal(tableSummary(facts, 7).total, 21);
  assert.equal(isTableFluent(facts, 7), false);
  for (const b of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    drill(facts, factKey(7, b), [[true, 2000], [true, 2000], [true, 2000]]);
    drill(facts, factKey(b, 7), [[true, 2000], [true, 2000], [true, 2000]]);
  }
  assert.equal(isTableFluent(facts, 7), true);
});

test('weakest returns the lowest-fluency seen facts first', () => {
  const facts = {};
  drill(facts, '7x8', [[false, null], [false, null], [false, null]]);
  drill(facts, '6x7', [[true, 5000], [true, 5000], [false, null]]);
  drill(facts, '2x2', [[true, 1000], [true, 1000], [true, 1000]]);
  const w = weakest(facts, 3).map((x) => x.key);
  assert.equal(w[0], '7x8');
  assert.ok(w.includes('6x7'));
  assert.ok(!w.includes('2x2'));
});
