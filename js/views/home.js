import { esc } from '../util.js';
import { summarize, tableSummary } from '../adaptive.js';
import { TABLES } from '../mtc.js';

export function render(el, { store, profile, navigate }) {
  const facts = store.facts(profile.id);
  const rewards = store.rewards(profile.id);
  const sum = summarize(facts);
  const last = store.lastCheck(profile.id);
  const best = store.bestCheck(profile.id);
  const checks = store.checks(profile.id).length;
  const perRound = profile.settings.questionsPerRound || 15;

  el.innerHTML = `
    <div class="topbar">
      <button type="button" class="who" data-go="#profiles" style="--pc:${esc(profile.colour)}33"><span class="av">${esc(profile.avatar)}</span>${esc(profile.name)}</button>
      <div class="row"><span class="stat">⭐ ${rewards.stars}</span><span class="stat">🔥 ${rewards.streak}</span></div>
    </div>
    <div class="hero"><h1>Hi ${esc(profile.name)}! 👋</h1><p class="muted">${checks === 0 ? 'Ready for lift off?' : 'What shall we do today?'}</p></div>
    ${checks === 0 ? '<div class="nudge">🚀 Start with a <b>Real Check</b> to find your starting score</div>' : ''}
    <div class="mode-grid">
      <button type="button" class="mode check ${checks === 0 ? 'highlight' : ''}" data-go="#check"><span class="ico">📝</span>Real Check<small>25 questions · 6 seconds each</small></button>
      <button type="button" class="mode practice" data-go="#practice"><span class="ico">🎯</span>Practice<small>${perRound} questions picked for you</small></button>
      <button type="button" class="mode table" data-act="tables"><span class="ico">🔢</span>Pick a table<small>Practise one times table</small></button>
      <button type="button" class="mode progress" data-go="#progress"><span class="ico">🗺️</span>My progress<small>Fact map & badges</small></button>
    </div>
    <div class="card" data-tables hidden>
      <h2>Which table?</h2>
      <div class="table-picker">
        ${TABLES.map((t) => { const s = tableSummary(facts, t); return `<button type="button" data-go="#table/${t}">${t}s<span class="bar"><i style="width:${Math.round(100 * s.fluent / s.total)}%"></i></span></button>`; }).join('')}
      </div>
    </div>
    <div class="summary">
      <div class="card"><div class="big">${last ? `${last.score}<small style="font-size:1rem">/25</small>` : '–'}</div><div class="lbl">Last check</div></div>
      <div class="card"><div class="big">${checks ? `${best}<small style="font-size:1rem">/25</small>` : '–'}</div><div class="lbl">Best check</div></div>
      <div class="card"><div class="big">${sum.exploredPairs}<small style="font-size:1rem">/${sum.totalPairs}</small></div><div class="lbl">Facts explored</div></div>
      <div class="card"><div class="big">${sum.fluent}</div><div class="lbl">Fluent facts</div></div>
    </div>
    <div class="footer-links"><a href="#grownups">Grown-ups</a></div>`;

  el.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { navigate(go.dataset.go); return; }
    if (e.target.closest('[data-act="tables"]')) {
      const box = el.querySelector('[data-tables]');
      box.hidden = !box.hidden;
      if (!box.hidden) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}
