// Stars, streaks and badges. Pure functions, no DOM.

import { dayKey, DAY_MS } from './util.js';
import { TABLES } from './mtc.js';
import { summarize, isTableFluent } from './adaptive.js';

export function newRewards() {
  return { stars: 0, streak: 0, lastPracticeDay: null, badges: [] };
}

const TABLE_BADGES = TABLES.map((t) => ({
  id: `table-${t}`,
  emoji: '🏅',
  name: `${t}s master`,
  description: `Every question in the ${t} times table is fluent`,
  test: ({ facts }) => isTableFluent(facts, t),
}));

export const BADGES = [
  { id: 'first-check', emoji: '🚀', name: 'Lift off', description: 'Finished your first Test Simulation', test: ({ sessions }) => sessions.some((s) => s.type === 'check') },
  { id: 'first-practice', emoji: '🎯', name: 'Warmed up', description: 'Finished your first practice round', test: ({ sessions }) => sessions.some((s) => s.type !== 'check') },
  { id: 'map-half', emoji: '🗺️', name: 'Explorer', description: 'Tried half of all the questions', test: ({ summary }) => summary.exploredPairs >= summary.totalPairs / 2 },
  { id: 'map-full', emoji: '🧭', name: 'Map complete', description: 'Tried every single question', test: ({ summary }) => summary.exploredPairs >= summary.totalPairs },
  { id: 'score-20', emoji: '⭐', name: 'Twenty club', description: 'Scored 20 or more in a Test Simulation', test: ({ session }) => session.type === 'check' && session.score >= 20 },
  { id: 'score-25', emoji: '🏆', name: 'Perfect 25', description: 'Full marks in a Test Simulation', test: ({ session }) => session.type === 'check' && session.score === 25 },
  { id: 'speedster', emoji: '⚡', name: 'Speedster', description: 'Averaged under 3 seconds in a Test Simulation with 20+', test: ({ session }) => session.type === 'check' && session.score >= 20 && session.avgMs != null && session.avgMs < 3000 },
  { id: 'streak-3', emoji: '🔥', name: 'On fire', description: 'Played 3 days in a row', test: ({ rewards }) => rewards.streak >= 3 },
  { id: 'streak-7', emoji: '🌋', name: 'Unstoppable', description: 'Played 7 days in a row', test: ({ rewards }) => rewards.streak >= 7 },
  { id: 'sessions-10', emoji: '💪', name: 'Ten rounds', description: 'Finished 10 rounds', test: ({ sessions }) => sessions.length >= 10 },
  { id: 'sessions-25', emoji: '🦁', name: 'Twenty-five rounds', description: 'Finished 25 rounds', test: ({ sessions }) => sessions.length >= 25 },
  { id: 'stars-50', emoji: '🌟', name: 'Star collector', description: 'Collected 50 stars', test: ({ rewards }) => rewards.stars >= 50 },
  { id: 'fluent-50', emoji: '🧠', name: 'Big brain', description: 'Half of all questions are fluent', test: ({ summary }) => summary.fluent >= summary.totalFacts / 2 },
  ...TABLE_BADGES,
];

export function badgeById(id) {
  return BADGES.find((b) => b.id === id);
}

/**
 * Update rewards after a session is recorded.
 * `sessions` must already include the new session; `facts` must already be updated.
 */
export function applySession(rewards, { session, sessions, facts, newlyFluent = 0, now = Date.now() }) {
  const r = { ...newRewards(), ...rewards, badges: [...(rewards?.badges || [])] };
  const today = dayKey(now);
  const yesterday = dayKey(now - DAY_MS);
  if (r.lastPracticeDay !== today) {
    r.streak = r.lastPracticeDay === yesterday ? r.streak + 1 : 1;
    r.lastPracticeDay = today;
  }

  const ratio = session.total ? session.score / session.total : 0;
  const prevBest = sessions
    .filter((s) => s.type === 'check' && s.id !== session.id)
    .reduce((m, s) => Math.max(m, s.score), -1);
  let starsEarned = 1;
  if (ratio >= 0.8) starsEarned++;
  if ((session.type === 'check' && session.score > prevBest && prevBest >= 0) || newlyFluent > 0) starsEarned++;
  r.stars += starsEarned;

  const summary = summarize(facts);
  const ctx = { session, sessions, facts, rewards: r, summary };
  const newBadges = [];
  for (const b of BADGES) {
    if (r.badges.includes(b.id)) continue;
    let earned = false;
    try { earned = !!b.test(ctx); } catch { earned = false; }
    if (earned) { r.badges.push(b.id); newBadges.push(b.id); }
  }
  return { rewards: r, starsEarned, newBadges };
}
