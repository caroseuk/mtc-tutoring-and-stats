import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySession, newRewards, BADGES, badgeById } from '../js/rewards.js';
import { DAY_MS } from '../js/util.js';

const NOW = Date.parse('2026-09-14T10:00:00');
const mk = (over = {}) => ({ id: 's1', type: 'practice', score: 12, total: 15, avgMs: 2800, questions: [], ...over });

test('streak counts consecutive days once per day', () => {
  let r = newRewards();
  ({ rewards: r } = applySession(r, { session: mk(), sessions: [mk()], facts: {}, now: NOW }));
  assert.equal(r.streak, 1);
  ({ rewards: r } = applySession(r, { session: mk({ id: 's2' }), sessions: [mk(), mk({ id: 's2' })], facts: {}, now: NOW + 3600_000 }));
  assert.equal(r.streak, 1);
  ({ rewards: r } = applySession(r, { session: mk({ id: 's3' }), sessions: [], facts: {}, now: NOW + DAY_MS }));
  assert.equal(r.streak, 2);
  ({ rewards: r } = applySession(r, { session: mk({ id: 's4' }), sessions: [], facts: {}, now: NOW + 5 * DAY_MS }));
  assert.equal(r.streak, 1);
});

test('stars: 1 for finishing, +1 for 80%, +1 for a new best check or newly fluent facts', () => {
  const low = applySession(newRewards(), { session: mk({ score: 5 }), sessions: [], facts: {}, now: NOW });
  assert.equal(low.starsEarned, 1);
  const good = applySession(newRewards(), { session: mk({ score: 13 }), sessions: [], facts: {}, now: NOW });
  assert.equal(good.starsEarned, 2);
  const fluent = applySession(newRewards(), { session: mk({ score: 13 }), sessions: [], facts: {}, newlyFluent: 2, now: NOW });
  assert.equal(fluent.starsEarned, 3);
  const prev = mk({ id: 'c0', type: 'check', score: 18, total: 25 });
  const best = mk({ id: 'c1', type: 'check', score: 21, total: 25 });
  const beat = applySession(newRewards(), { session: best, sessions: [prev, best], facts: {}, now: NOW });
  assert.equal(beat.starsEarned, 3);
  assert.equal(beat.rewards.stars, 3);
});

test('badges are awarded once and remembered', () => {
  const check = mk({ id: 'c1', type: 'check', score: 25, total: 25, avgMs: 2500 });
  const first = applySession(newRewards(), { session: check, sessions: [check], facts: {}, now: NOW });
  assert.ok(first.newBadges.includes('first-check'));
  assert.ok(first.newBadges.includes('score-20'));
  assert.ok(first.newBadges.includes('score-25'));
  assert.ok(first.newBadges.includes('speedster'));
  const again = applySession(first.rewards, { session: mk({ id: 'c2', type: 'check', score: 25, total: 25 }), sessions: [check], facts: {}, now: NOW });
  assert.ok(!again.newBadges.includes('score-25'));
  assert.equal(again.rewards.badges.filter((b) => b === 'score-25').length, 1);
});

test('every badge has an id, emoji, name and description', () => {
  const ids = new Set();
  for (const b of BADGES) {
    assert.ok(b.id && b.emoji && b.name && b.description);
    assert.ok(!ids.has(b.id));
    ids.add(b.id);
  }
  assert.equal(badgeById('table-7').name, '7s master');
});
