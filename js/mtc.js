// Official Multiplication Tables Check (MTC) question generator.
// Rules follow the DfE assessment framework:
//  - 25 questions from the 2 to 12 times tables (no 1 times table)
//  - per-table quotas (see RANGES), at most 7 questions from the 2, 5 and 10 tables combined
//  - a fact and its reversal (3x8 / 8x3) never both appear in one check
//  - 6 seconds to answer, 3 second pause between questions, 3 unscored warm-up questions

import { shuffle, pick } from './util.js';

export const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const TOTAL = 25;
export const SECONDS_PER_QUESTION = 6;
export const PAUSE_SECONDS = 3;
export const WARMUP_COUNT = 3;
export const EASY_TABLES = [2, 5, 10];
export const EASY_TABLES_CAP = 7;

/** Allowed number of questions per table: [min, max]. */
export const RANGES = {
  2: [0, 2], 10: [0, 2],
  3: [1, 3], 4: [1, 3], 5: [1, 3], 11: [1, 3],
  6: [2, 4], 7: [2, 4], 8: [2, 4], 9: [2, 4], 12: [2, 4],
};

/** Order-independent key for a multiplication pair. */
export function pairKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function easySum(counts) {
  return EASY_TABLES.reduce((s, t) => s + (counts[t] || 0), 0);
}

/** Decide how many questions each table contributes, honouring every quota. */
export function planCounts(rng = Math.random) {
  const counts = {};
  let total = 0;
  for (const t of TABLES) {
    counts[t] = RANGES[t][0];
    total += counts[t];
  }
  while (total < TOTAL) {
    const open = TABLES.filter(
      (t) => counts[t] < RANGES[t][1] && !(EASY_TABLES.includes(t) && easySum(counts) >= EASY_TABLES_CAP),
    );
    counts[pick(open, rng)]++;
    total++;
  }
  return counts;
}

/**
 * Generate one official-style check: 25 {a, b, table} questions in display order.
 * `table` records which times table the question was drawn for.
 */
export function generateCheck(rng = Math.random) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const counts = planCounts(rng);
    const used = new Set();
    const questions = [];
    let ok = true;
    // Tables with the most questions choose partners first, so they never run out.
    const order = shuffle(TABLES, rng).sort((x, y) => counts[y] - counts[x]);
    for (const t of order) {
      const partners = shuffle(TABLES, rng).filter((m) => !used.has(pairKey(t, m)));
      if (partners.length < counts[t]) { ok = false; break; }
      for (let i = 0; i < counts[t]; i++) {
        const m = partners[i];
        used.add(pairKey(t, m));
        const flip = rng() < 0.5;
        questions.push({ a: flip ? m : t, b: flip ? t : m, table: t });
      }
    }
    if (ok) return shuffle(questions, rng);
  }
  throw new Error('Could not generate a valid check');
}

/** Three easy, unscored warm-up questions like the ones before the real check. */
export function generateWarmup(rng = Math.random) {
  const out = [];
  const used = new Set();
  const tables = shuffle(EASY_TABLES, rng);
  for (let i = 0; i < WARMUP_COUNT; i++) {
    const t = tables[i % tables.length];
    let m;
    do { m = pick(TABLES, rng); } while (used.has(pairKey(t, m)));
    used.add(pairKey(t, m));
    const flip = rng() < 0.5;
    out.push({ a: flip ? m : t, b: flip ? t : m, table: t, warmup: true });
  }
  return out;
}

/** Return a list of rule violations for a set of questions (empty when valid). */
export function validateCheck(questions) {
  const errors = [];
  if (questions.length !== TOTAL) errors.push(`expected ${TOTAL} questions, got ${questions.length}`);
  const pairs = new Set();
  const counts = {};
  for (const q of questions) {
    if (!TABLES.includes(q.a) || !TABLES.includes(q.b)) errors.push(`${q.a}x${q.b} is outside the 2-12 tables`);
    if (q.table !== q.a && q.table !== q.b) errors.push(`${q.a}x${q.b} attributed to table ${q.table}`);
    const k = pairKey(q.a, q.b);
    if (pairs.has(k)) errors.push(`pair ${k} appears twice (duplicate or reversal)`);
    pairs.add(k);
    counts[q.table] = (counts[q.table] || 0) + 1;
  }
  for (const t of TABLES) {
    const c = counts[t] || 0;
    const [lo, hi] = RANGES[t];
    if (c < lo || c > hi) errors.push(`table ${t} has ${c} questions (allowed ${lo}-${hi})`);
  }
  if (easySum(counts) > EASY_TABLES_CAP) errors.push(`tables 2, 5 and 10 have ${easySum(counts)} questions (max ${EASY_TABLES_CAP})`);
  return errors;
}
