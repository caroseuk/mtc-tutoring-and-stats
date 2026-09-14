import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCheck, generateWarmup, validateCheck, planCounts, TOTAL, RANGES, TABLES, pairKey } from '../js/mtc.js';
import { seededRandom } from '../js/util.js';

test('1000 generated checks all satisfy every official rule', () => {
  for (let seed = 1; seed <= 1000; seed++) {
    const qs = generateCheck(seededRandom(seed));
    const errors = validateCheck(qs);
    assert.deepEqual(errors, [], `seed ${seed}: ${errors.join('; ')}`);
  }
});

test('generation is deterministic for a given seed', () => {
  assert.deepEqual(generateCheck(seededRandom(42)), generateCheck(seededRandom(42)));
  assert.notDeepEqual(generateCheck(seededRandom(42)), generateCheck(seededRandom(43)));
});

test('planCounts always totals 25 within per-table ranges', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const counts = planCounts(seededRandom(seed));
    let total = 0;
    for (const t of TABLES) {
      assert.ok(counts[t] >= RANGES[t][0] && counts[t] <= RANGES[t][1]);
      total += counts[t];
    }
    assert.equal(total, TOTAL);
    assert.ok(counts[2] + counts[5] + counts[10] <= 7);
  }
});

test('harder tables come up more often across many checks', () => {
  const tally = {};
  for (let seed = 1; seed <= 300; seed++) {
    for (const q of generateCheck(seededRandom(seed))) tally[q.table] = (tally[q.table] || 0) + 1;
  }
  assert.ok(tally[7] > tally[2] * 1.5);
  assert.ok(tally[8] > tally[10] * 1.5);
});

test('both orientations of a fact are used', () => {
  let tFirst = 0, tSecond = 0;
  for (let seed = 1; seed <= 100; seed++) {
    for (const q of generateCheck(seededRandom(seed))) {
      if (q.a === q.b) continue;
      if (q.a === q.table) tFirst++; else tSecond++;
    }
  }
  assert.ok(tFirst > 500 && tSecond > 500);
});

test('validateCheck reports reversals, bad tables and quota breaches', () => {
  const qs = generateCheck(seededRandom(7));
  const q0 = qs[0];
  const withReversal = [...qs];
  withReversal[1] = { a: q0.b, b: q0.a, table: q0.table };
  assert.ok(validateCheck(withReversal).some((e) => e.includes(pairKey(q0.a, q0.b))));

  const withOne = [...qs];
  withOne[0] = { a: 1, b: 5, table: 5 };
  assert.ok(validateCheck(withOne).some((e) => e.includes('outside')));

  assert.ok(validateCheck(qs.slice(0, 24)).some((e) => e.includes('expected 25')));
});

test('warm-up gives 3 easy questions from the 2, 5 and 10 tables', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const w = generateWarmup(seededRandom(seed));
    assert.equal(w.length, 3);
    for (const q of w) {
      assert.ok([2, 5, 10].includes(q.table));
      assert.ok(q.warmup);
    }
    const pairs = new Set(w.map((q) => pairKey(q.a, q.b)));
    assert.equal(pairs.size, 3);
  }
});
