import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, memoryStorage, STORAGE_KEY } from '../js/store.js';
import { status } from '../js/adaptive.js';

const NOW = Date.parse('2026-09-14T10:00:00');
const q = (a, b, correct, ms, extra = {}) => ({ a, b, answer: a * b, given: correct ? a * b : 0, correct, ms, ...extra });

test('profiles can be added, updated, switched and deleted', () => {
  const s = createStore(memoryStorage());
  const p1 = s.addProfile({ name: 'Ada', avatar: '🦊' });
  const p2 = s.addProfile({ name: 'Ben' });
  assert.equal(s.activeProfile().id, p1.id);
  s.setActive(p2.id);
  assert.equal(s.activeProfile().name, 'Ben');
  s.updateProfile(p2.id, { name: 'Benji', settings: { sound: false } });
  assert.equal(s.profile(p2.id).name, 'Benji');
  assert.equal(s.profile(p2.id).settings.sound, false);
  assert.equal(s.profile(p2.id).settings.questionsPerRound, 15);
  s.deleteProfile(p2.id);
  assert.equal(s.profiles().length, 1);
  assert.equal(s.activeProfile().id, p1.id);
});

test('state survives a reload from the same storage', () => {
  const storage = memoryStorage();
  const s = createStore(storage);
  s.addProfile({ name: 'Ada' });
  const s2 = createStore(storage);
  assert.equal(s2.profiles()[0].name, 'Ada');
  assert.ok(storage.getItem(STORAGE_KEY));
});

test('recordSession scores, updates facts, rewards and badges', () => {
  const s = createStore(memoryStorage());
  const p = s.addProfile({ name: 'Ada' });
  const questions = [q(7, 8, true, 2000), q(6, 7, false, null), q(3, 4, true, 1500), q(6, 7, true, 2500, { retry: true })];
  const res = s.recordSession(p.id, { type: 'practice', startedAt: NOW - 60000, questions }, NOW);
  assert.equal(res.session.score, 2);
  assert.equal(res.session.total, 3);
  assert.equal(res.session.questions.length, 4);
  assert.ok(res.session.avgMs > 0);
  assert.equal(s.facts(p.id)['7x8'].n, 1);
  assert.equal(s.facts(p.id)['6x7'].n, 2);
  assert.equal(s.rewards(p.id).stars, res.starsEarned);
  assert.ok(res.newBadges.includes('first-practice'));
  assert.equal(s.sessions(p.id).length, 1);
});

test('newlyFluent is counted when a fact crosses into fluent', () => {
  const s = createStore(memoryStorage());
  const p = s.addProfile({ name: 'Ada' });
  s.recordSession(p.id, { type: 'practice', startedAt: NOW, questions: [q(7, 8, true, 2000), q(7, 8, true, 2000)] }, NOW);
  const res = s.recordSession(p.id, { type: 'practice', startedAt: NOW, questions: [q(7, 8, true, 2000)] }, NOW);
  assert.equal(res.newlyFluent, 1);
  assert.equal(status(s.facts(p.id)['7x8']), 'fluent');
});

test('check helpers report best and last check', () => {
  const s = createStore(memoryStorage());
  const p = s.addProfile({ name: 'Ada' });
  const twentyFive = Array.from({ length: 25 }, (_, i) => q(2 + (i % 11), 2 + Math.floor(i / 11), i < 18, 2500));
  s.recordSession(p.id, { type: 'check', startedAt: NOW, questions: twentyFive }, NOW);
  assert.equal(s.bestCheck(p.id), 18);
  assert.equal(s.lastCheck(p.id).score, 18);
  assert.equal(s.checks(p.id).length, 1);
});

test('export/import round-trips and merges by profile id', () => {
  const s = createStore(memoryStorage());
  const p = s.addProfile({ name: 'Ada' });
  s.recordSession(p.id, { type: 'practice', startedAt: NOW, questions: [q(7, 8, true, 2000)] }, NOW);
  const json = s.exportJSON();

  const fresh = createStore(memoryStorage());
  fresh.addProfile({ name: 'Ben' });
  const n = fresh.importJSON(json);
  assert.equal(n, 1);
  assert.equal(fresh.profiles().length, 2);
  assert.equal(fresh.facts(p.id)['7x8'].n, 1);

  const replaced = createStore(memoryStorage());
  replaced.addProfile({ name: 'Ben' });
  replaced.importJSON(json, { mode: 'replace' });
  assert.equal(replaced.profiles().length, 1);
  assert.equal(replaced.profiles()[0].name, 'Ada');

  assert.throws(() => fresh.importJSON('not json'), /valid JSON/);
  assert.throws(() => fresh.importJSON('{"hello":1}'), /not an MTC/);
  assert.throws(() => fresh.importJSON('{"version":99,"profiles":[]}'), /newer version/);
});

test('reset clears a profile or everything', () => {
  const s = createStore(memoryStorage());
  const p = s.addProfile({ name: 'Ada' });
  s.recordSession(p.id, { type: 'practice', startedAt: NOW, questions: [q(7, 8, true, 2000)] }, NOW);
  s.resetProfile(p.id);
  assert.deepEqual(s.facts(p.id), {});
  assert.equal(s.rewards(p.id).stars, 0);
  s.resetAll();
  assert.equal(s.profiles().length, 0);
});
