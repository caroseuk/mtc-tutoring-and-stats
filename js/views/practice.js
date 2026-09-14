// Adaptive practice round, and "pick a table" rounds (route #table/N).
import { selectTraining, tableSummary } from '../adaptive.js';
import { SECONDS_PER_QUESTION, PAUSE_SECONDS, TABLES } from '../mtc.js';
import { runSession } from '../session.js';

export function render(el, { store, profile, navigate, audio, announce, shared, route, params }) {
  const table = route === 'table' ? Number(params[0]) : null;
  if (route === 'table' && !TABLES.includes(table)) { navigate('#home'); return; }
  const facts = store.facts(profile.id);
  let count = profile.settings.questionsPerRound || 15;
  let session = null;

  const ts = table ? tableSummary(facts, table) : null;
  el.innerHTML = `
    <div class="card stack" style="margin:auto; max-width:520px; text-align:center">
      <h1>${table ? `🔢 The ${table}s` : '🎯 Practice'}</h1>
      <p>${table
        ? `${ts.fluent} of ${ts.total} facts in the ${table} times table are fluent.`
        : 'Questions picked just for you: the ones you find tricky, plus a few you know.'}</p>
      <p class="muted">You get ${SECONDS_PER_QUESTION} seconds each and see the answer straight away.</p>
      <div class="row center" data-count>
        ${[10, 15, 20].map((n) => `<button type="button" class="chip btn-chip ${n === count ? 'on' : ''}" data-n="${n}">${n} questions</button>`).join('')}
      </div>
      <button type="button" class="btn good big" data-act="start">Go! 🎯</button>
      <button type="button" class="btn ghost small" data-act="back">Back</button>
    </div>`;

  el.addEventListener('click', async (e) => {
    const n = e.target.closest('[data-n]');
    if (n) {
      count = Number(n.dataset.n);
      el.querySelectorAll('[data-n]').forEach((b) => b.classList.toggle('on', b === n));
      store.updateProfile(profile.id, { settings: { questionsPerRound: count } });
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'back') return navigate('#home');
    if (act !== 'start' || session) return;
    const questions = selectTraining(facts, count, { filter: table ? ({ a, b }) => a === table || b === table : null });
    session = runSession(el, {
      questions,
      seconds: SECONDS_PER_QUESTION,
      pause: PAUSE_SECONDS,
      feedback: true,
      retryWrong: true,
      theme: 'fun',
      audio,
      announce,
    });
    const out = await session.promise;
    session = null;
    if (!out) return navigate('#home');
    const res = store.recordSession(profile.id, { type: table ? 'table' : 'practice', table, ...out });
    shared.lastResult = res;
    if (res.newBadges.length || res.newlyFluent) audio.fanfare();
    navigate(`#results/${res.session.id}`);
  });

  return () => { if (session) session.abort(); };
}
