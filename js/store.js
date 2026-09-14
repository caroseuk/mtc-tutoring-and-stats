// Persistence: profiles, facts, sessions and rewards in localStorage (or any
// getItem/setItem/removeItem object, so tests can use an in-memory one).

import { updateFact, status, factKey } from './adaptive.js';
import { applySession, newRewards } from './rewards.js';
import { uid, mean } from './util.js';

export const STORAGE_KEY = 'mtc:v1';
export const VERSION = 1;
export const MAX_SESSIONS = 300;
export const AVATARS = ['🦊', '🐼', '🦄', '🐯', '🐸', '🦖', '🐙', '🦋', '🐨', '🚀', '🌈', '⚽'];
export const COLOURS = ['#7c4dff', '#ff6d00', '#00bfa5', '#ff4081', '#2979ff', '#ffc400'];

export function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

export function emptyState() {
  return { version: VERSION, activeProfileId: null, profiles: [], facts: {}, sessions: {}, rewards: {} };
}

/** Bring any older/partial state up to the current shape. */
export function migrate(raw) {
  const s = { ...emptyState(), ...(raw && typeof raw === 'object' ? raw : {}) };
  s.version = VERSION;
  if (!Array.isArray(s.profiles)) s.profiles = [];
  for (const k of ['facts', 'sessions', 'rewards']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
  for (const p of s.profiles) {
    p.settings = { sound: true, questionsPerRound: 15, ...(p.settings || {}) };
    s.facts[p.id] ||= {};
    s.sessions[p.id] ||= [];
    s.rewards[p.id] = { ...newRewards(), ...(s.rewards[p.id] || {}) };
  }
  if (s.activeProfileId && !s.profiles.some((p) => p.id === s.activeProfileId)) s.activeProfileId = null;
  return s;
}

export function createStore(storage = globalThis.localStorage || memoryStorage()) {
  let state = emptyState();

  function load() {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      state = migrate(raw ? JSON.parse(raw) : null);
    } catch {
      state = emptyState();
    }
    return state;
  }

  function save() {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  const api = {
    get state() { return state; },
    load,
    save,

    profiles: () => state.profiles,
    profile: (id) => state.profiles.find((p) => p.id === id) || null,
    activeProfile: () => api.profile(state.activeProfileId),
    setActive(id) { state.activeProfileId = id; save(); },

    addProfile({ name, avatar = AVATARS[0], colour = COLOURS[0] }) {
      const p = { id: uid('p_'), name: String(name).trim().slice(0, 20) || 'Me', avatar, colour, createdAt: Date.now(), settings: { sound: true, questionsPerRound: 15 } };
      state.profiles.push(p);
      state.facts[p.id] = {};
      state.sessions[p.id] = [];
      state.rewards[p.id] = newRewards();
      if (!state.activeProfileId) state.activeProfileId = p.id;
      save();
      return p;
    },
    updateProfile(id, patch) {
      const p = api.profile(id);
      if (!p) return null;
      Object.assign(p, patch, { settings: { ...p.settings, ...(patch.settings || {}) } });
      save();
      return p;
    },
    deleteProfile(id) {
      state.profiles = state.profiles.filter((p) => p.id !== id);
      delete state.facts[id]; delete state.sessions[id]; delete state.rewards[id];
      if (state.activeProfileId === id) state.activeProfileId = state.profiles[0]?.id || null;
      save();
    },
    resetProfile(id) {
      if (!api.profile(id)) return;
      state.facts[id] = {}; state.sessions[id] = []; state.rewards[id] = newRewards();
      save();
    },
    resetAll() { state = emptyState(); save(); },

    facts: (id) => state.facts[id] || {},
    sessions: (id) => state.sessions[id] || [],
    rewards: (id) => state.rewards[id] || newRewards(),
    checks: (id) => api.sessions(id).filter((s) => s.type === 'check'),
    bestCheck: (id) => api.checks(id).reduce((m, s) => Math.max(m, s.score), 0),
    lastCheck: (id) => api.checks(id).slice(-1)[0] || null,

    /**
     * Record a finished session. `questions` = [{a, b, answer, given, correct, ms, retry?}].
     * Updates facts, appends the session, applies rewards, saves.
     */
    recordSession(profileId, { type, startedAt, secondsPerQuestion = 6, questions, table = null }, now = Date.now()) {
      if (!api.profile(profileId)) throw new Error('Unknown profile');
      const facts = state.facts[profileId] ||= {};
      let newlyFluent = 0;
      for (const q of questions) {
        const key = factKey(q.a, q.b);
        const before = status(facts[key]);
        facts[key] = updateFact(facts[key], { correct: q.correct, ms: q.ms, at: now });
        if (before !== 'fluent' && status(facts[key]) === 'fluent') newlyFluent++;
      }
      const scored = questions.filter((q) => !q.retry);
      const session = {
        id: uid('s_'), type, table, startedAt, endedAt: now, secondsPerQuestion,
        score: scored.filter((q) => q.correct).length,
        total: scored.length,
        avgMs: mean(scored.map((q) => (q.ms == null ? secondsPerQuestion * 1000 : q.ms))),
        questions,
      };
      const sessions = state.sessions[profileId] ||= [];
      sessions.push(session);
      if (sessions.length > MAX_SESSIONS) sessions.splice(0, sessions.length - MAX_SESSIONS);
      const result = applySession(state.rewards[profileId], { session, sessions, facts, newlyFluent, now });
      state.rewards[profileId] = result.rewards;
      save();
      return { session, starsEarned: result.starsEarned, newBadges: result.newBadges, newlyFluent };
    },

    exportJSON() {
      return JSON.stringify({ ...state, exportedAt: new Date().toISOString(), app: 'mtc-practice' }, null, 2);
    },

    /** Import a backup. mode 'merge' keeps existing children and overwrites any with the same id. */
    importJSON(text, { mode = 'merge' } = {}) {
      let raw;
      try { raw = JSON.parse(text); } catch { throw new Error('That file is not valid JSON'); }
      if (!raw || typeof raw !== 'object' || !Array.isArray(raw.profiles)) throw new Error('That file is not an MTC practice backup');
      if ((raw.version || 1) > VERSION) throw new Error('That backup comes from a newer version of the app');
      const incoming = migrate(raw);
      if (mode === 'replace') {
        state = incoming;
      } else {
        for (const p of incoming.profiles) {
          state.profiles = state.profiles.filter((x) => x.id !== p.id);
          state.profiles.push(p);
          state.facts[p.id] = incoming.facts[p.id];
          state.sessions[p.id] = incoming.sessions[p.id];
          state.rewards[p.id] = incoming.rewards[p.id];
        }
        if (!state.activeProfileId) state.activeProfileId = state.profiles[0]?.id || null;
      }
      state = migrate(state);
      save();
      return incoming.profiles.length;
    },
  };

  load();
  return api;
}
