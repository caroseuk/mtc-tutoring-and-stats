// Fact model and adaptive training selection. Pure functions, no DOM.
//
// Every ordered fact (2x2 ... 12x12, 121 in total) has a record that tracks
// accuracy and speed. From that we derive a fluency score, a status bucket and
// a priority used to build tailored practice rounds.

import { TABLES } from './mtc.js';
import { clamp, shuffle, DAY_MS } from './util.js';

export const FACT_KEYS = [];
for (const a of TABLES) for (const b of TABLES) FACT_KEYS.push(`${a}x${b}`);
export const TOTAL_PAIRS = 66; // unordered pairs from the 2-12 tables

export const FAST_MS = 2500;     // at or under this = full speed marks
export const SLOW_MS = 6000;     // at or over this (or a timeout) = zero speed marks
export const PROMOTE_MS = 3500;  // correct and faster than this moves a fact up a stage
export const ALPHA = 0.3;        // EWMA weight for the newest answer
export const INTERVALS_DAYS = [0, 1, 3, 7, 14];
export const FLUENT_AT = 0.8;
export const NEARLY_AT = 0.5;
export const MIN_ATTEMPTS = 2;   // fewer than this and the fact is still "unknown"

export function factKey(a, b) { return `${a}x${b}`; }
export function parseKey(key) { const [a, b] = key.split('x').map(Number); return { a, b }; }
export function reverseKey(key) { const { a, b } = parseKey(key); return factKey(b, a); }

export function newFact() {
  return { n: 0, correct: 0, ewmaAcc: null, ewmaMs: null, last3: [], stage: 0, due: 0, lastSeen: 0 };
}

/** 1.0 for fast answers, 0 for slow/timeouts, linear in between. */
export function speedScore(ms) {
  if (ms == null) return 0;
  return clamp((SLOW_MS - ms) / (SLOW_MS - FAST_MS), 0, 1);
}

/** Pure reducer: apply one answer to a fact record. */
export function updateFact(fact, { correct, ms, at = Date.now() }) {
  const f = { ...(fact || newFact()), last3: (fact?.last3 || []).slice() };
  const acc = correct ? 1 : 0;
  const t = correct ? Math.min(ms ?? SLOW_MS, SLOW_MS) : SLOW_MS;
  f.n += 1;
  f.correct += acc;
  const alpha = Math.max(ALPHA, 1 / f.n); // warm start: plain mean for the first few answers
  f.ewmaAcc = f.ewmaAcc == null ? acc : f.ewmaAcc + alpha * (acc - f.ewmaAcc);
  f.ewmaMs = f.ewmaMs == null ? t : f.ewmaMs + alpha * (t - f.ewmaMs);
  f.last3.push(acc);
  if (f.last3.length > 3) f.last3.shift();
  if (!correct) f.stage = 0;
  else if (ms != null && ms <= PROMOTE_MS) f.stage = Math.min(f.stage + 1, INTERVALS_DAYS.length - 1);
  f.lastSeen = at;
  f.due = at + INTERVALS_DAYS[f.stage] * DAY_MS;
  return f;
}

/** 0..1 blend of accuracy and speed, or null while the fact is unknown. */
export function fluency(fact) {
  if (!fact || fact.n < MIN_ATTEMPTS) return null;
  return 0.6 * fact.ewmaAcc + 0.4 * speedScore(fact.ewmaMs);
}

export function status(fact) {
  const fl = fluency(fact);
  if (fl == null) return 'unknown';
  if (fl >= FLUENT_AT && fact.n >= 3 && fact.last3.length === 3 && fact.last3.every(Boolean)) return 'fluent';
  if (fl >= NEARLY_AT) return 'nearly';
  return 'learning';
}

/**
 * Status for a fact, falling back to its reversal when this orientation is
 * unseen (knowing 7x8 says a lot about 8x7). Derived facts are never "fluent":
 * the child has to prove each orientation.
 */
export function effective(facts, key) {
  const f = facts[key];
  if (f && f.n >= MIN_ATTEMPTS) return { fluency: fluency(f), status: status(f), derived: false, fact: f };
  const r = facts[reverseKey(key)];
  if (r && r.n >= MIN_ATTEMPTS) {
    const fl = fluency(r) * 0.85;
    return { fluency: fl, status: fl >= NEARLY_AT ? 'nearly' : 'learning', derived: true, fact: f || null };
  }
  return { fluency: null, status: 'unknown', derived: false, fact: f || null };
}

// How hard each table tends to be for Year 4 children. Used before we have data.
const TABLE_DIFFICULTY = { 2: 0.2, 3: 0.45, 4: 0.55, 5: 0.3, 6: 0.8, 7: 0.95, 8: 0.95, 9: 0.75, 10: 0.2, 11: 0.35, 12: 0.85 };

export function prior(a, b) {
  const hi = Math.max(TABLE_DIFFICULTY[a], TABLE_DIFFICULTY[b]);
  const lo = Math.min(TABLE_DIFFICULTY[a], TABLE_DIFFICULTY[b]);
  let p = hi * (0.7 + 0.3 * lo);
  if (a === b) p *= 0.85; // squares are usually learned early
  return clamp(p, 0.15, 1);
}

/** Higher = more worth asking now. Unseen facts always come first. */
export function priority(facts, key, now = Date.now()) {
  const { a, b } = parseKey(key);
  const e = effective(facts, key);
  const pr = prior(a, b);
  if (e.status === 'unknown') return 2 + pr;
  if (e.derived) return 1.2 + pr * (1 - e.fluency);
  const due = (e.fact?.due ?? 0) <= now;
  if (e.status === 'fluent') return (due ? 0.4 : 0.1) * (1 + pr * 0.5);
  return (1 - e.fluency) * (0.5 + pr) * (due ? 1.2 : 1);
}

function sharesFactor(q1, q2) {
  return q1.a === q2.a || q1.a === q2.b || q1.b === q2.a || q1.b === q2.b;
}

/** Order questions so no three in a row share a factor (interleaving helps recall). */
export function interleave(items, rng = Math.random) {
  const remaining = shuffle(items, rng);
  const out = [];
  while (remaining.length) {
    const prev1 = out[out.length - 1];
    const prev2 = out[out.length - 2];
    let idx = remaining.findIndex((q) => !(prev1 && prev2 && sharesFactor(q, prev1) && sharesFactor(q, prev2) && sharesFactor(prev1, prev2)));
    if (idx < 0) idx = 0;
    out.push(remaining.splice(idx, 1)[0]);
  }
  return out;
}

/**
 * Build a tailored practice round.
 *  ~60% weakest (unknown/learning), ~25% nearly-there, ~15% fluent review.
 *  `filter({a,b})` restricts the pool (e.g. one times table).
 */
export function selectTraining(facts, count, { now = Date.now(), rng = Math.random, filter = null } = {}) {
  const keys = FACT_KEYS.filter((k) => !filter || filter(parseKey(k)));
  const scored = keys.map((key) => {
    const { a, b } = parseKey(key);
    const e = effective(facts, key);
    return { key, a, b, e, p: priority(facts, key, now) * (0.85 + 0.3 * rng()) };
  });
  const byPriority = (arr) => arr.slice().sort((x, y) => y.p - x.p);
  const pools = {
    weak: scored.filter((x) => x.e.status === 'unknown' || x.e.status === 'learning'),
    nearly: scored.filter((x) => x.e.status === 'nearly'),
    fluent: scored.filter((x) => x.e.status === 'fluent'),
  };
  const nWeak = Math.round(count * 0.6);
  const nNearly = Math.round(count * 0.25);
  const nReview = count - nWeak - nNearly;

  const chosen = [];
  const taken = new Set();
  const take = (pool, n, allowReverse) => {
    for (const x of byPriority(pool)) {
      if (n <= 0 || chosen.length >= count) break;
      if (taken.has(x.key)) continue;
      if (!allowReverse && taken.has(reverseKey(x.key))) continue;
      chosen.push(x);
      taken.add(x.key);
      n--;
    }
  };
  take(pools.weak, nWeak, false);
  take(pools.nearly, nNearly, false);
  take(pools.fluent, nReview, false);
  take(scored, count - chosen.length, false); // backfill by priority
  take(scored, count - chosen.length, true);  // small pools (one table): allow reversals
  return interleave(chosen, rng).map((x) => ({ a: x.a, b: x.b, key: x.key }));
}

/** Counts per status across all 121 facts plus how much of the map is explored. */
export function summarize(facts) {
  const out = { unknown: 0, learning: 0, nearly: 0, fluent: 0, exploredPairs: 0, totalPairs: TOTAL_PAIRS, totalFacts: FACT_KEYS.length };
  const seenPairs = new Set();
  for (const key of FACT_KEYS) {
    out[effective(facts, key).status]++;
    const { a, b } = parseKey(key);
    if ((facts[key]?.n || 0) > 0) seenPairs.add(a < b ? `${a}-${b}` : `${b}-${a}`);
  }
  out.exploredPairs = seenPairs.size;
  return out;
}

/** Status counts for one times table (both orientations, 21 distinct facts). */
export function tableSummary(facts, t) {
  const keys = FACT_KEYS.filter((k) => { const { a, b } = parseKey(k); return a === t || b === t; });
  const out = { table: t, unknown: 0, learning: 0, nearly: 0, fluent: 0, total: keys.length };
  for (const k of keys) out[effective(facts, k).status]++;
  return out;
}

export function isTableFluent(facts, t) {
  const s = tableSummary(facts, t);
  return s.fluent === s.total;
}

/** The n facts most in need of work (seen facts only), weakest first. */
export function weakest(facts, n = 3) {
  return FACT_KEYS
    .map((key) => ({ key, ...parseKey(key), e: effective(facts, key) }))
    .filter((x) => x.e.status === 'learning' || x.e.status === 'nearly')
    .sort((x, y) => (x.e.derived - y.e.derived) || (x.e.fluency - y.e.fluency))
    .slice(0, n);
}
