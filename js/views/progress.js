import { esc, formatSeconds, formatDate } from '../util.js';
import { summarize, effective, factKey, tableSummary } from '../adaptive.js';
import { TABLES } from '../mtc.js';
import { BADGES } from '../rewards.js';

const STATUS_LABEL = { unknown: 'Not tried yet', learning: 'Still learning', nearly: 'Nearly there', fluent: 'Fluent!' };

export function scoreChart(checks, { max = 25 } = {}) {
  const pts = checks.slice(-20);
  if (pts.length < 2) return '';
  const W = 600, H = 200, padL = 34, padR = 12, padT = 12, padB = 28;
  const x = (i) => padL + (i * (W - padL - padR)) / (pts.length - 1);
  const y = (v) => padT + (1 - v / max) * (H - padT - padB);
  const line = pts.map((s, i) => `${x(i).toFixed(1)},${y(s.score).toFixed(1)}`).join(' ');
  const grid = [0, 5, 10, 15, 20, 25].map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" stroke="#e9e6f7"/><text x="${padL - 6}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="#6d6a8a">${v}</text>`).join('');
  const dots = pts.map((s, i) => `<circle cx="${x(i)}" cy="${y(s.score)}" r="5" fill="#7c4dff"/><text x="${x(i)}" y="${H - 8}" font-size="10" text-anchor="middle" fill="#6d6a8a">${formatDate(s.endedAt)}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Test Simulation scores over time">${grid}<polyline points="${line}" fill="none" stroke="#7c4dff" stroke-width="3" stroke-linejoin="round"/>${dots}</svg>`;
}

export function heatmap(facts) {
  let html = '<div class="heat"><div class="hd">×</div>';
  for (const b of TABLES) html += `<div class="hd">${b}</div>`;
  for (const a of TABLES) {
    html += `<div class="hd">${a}</div>`;
    for (const b of TABLES) {
      const key = factKey(a, b);
      const e = effective(facts, key);
      html += `<button type="button" class="cell s-${e.status} ${e.derived ? 'derived' : ''}" data-key="${key}" aria-label="${a} times ${b}: ${STATUS_LABEL[e.status]}">${a * b}</button>`;
    }
  }
  return html + '</div>';
}

export function render(el, { store, profile, navigate }) {
  const facts = store.facts(profile.id);
  const rewards = store.rewards(profile.id);
  const sum = summarize(facts);
  const checks = store.checks(profile.id);

  el.innerHTML = `
    <div class="topbar">
      <button type="button" class="btn ghost small" data-go="#home">← Home</button>
      <div class="row"><span class="stat">⭐ ${rewards.stars}</span><span class="stat">🔥 ${rewards.streak}</span></div>
    </div>
    <h1>🗺️ ${esc(profile.name)}'s progress</h1>
    <div class="summary" style="margin-bottom:14px">
      <div class="card"><div class="big" style="color:var(--good-dark)">${sum.fluent}</div><div class="lbl">Fluent</div></div>
      <div class="card"><div class="big" style="color:#b45309">${sum.nearly}</div><div class="lbl">Nearly there</div></div>
      <div class="card"><div class="big" style="color:#b91c1c">${sum.learning}</div><div class="lbl">Still learning</div></div>
      <div class="card"><div class="big" style="color:var(--muted)">${sum.unknown}</div><div class="lbl">Not tried</div></div>
    </div>
    <div class="card stack">
      <h2>Times tables map</h2>
      <div class="legend"><span><i class="s-fluent"></i>Fluent</span><span><i class="s-nearly"></i>Nearly</span><span><i class="s-learning"></i>Learning</span><span><i class="s-unknown"></i>Not tried</span></div>
      ${heatmap(facts)}
      <div class="cell-detail muted" data-detail>Tap a square to see how you're doing with that question</div>
    </div>
    <div class="card stack" style="margin-top:14px">
      <h2>Times tables</h2>
      <div class="table-status">
        ${TABLES.map((t) => { const s = tableSummary(facts, t); const cls = s.fluent === s.total ? 's-fluent' : s.unknown === s.total ? 's-unknown' : s.learning > s.total / 3 ? 's-learning' : 's-nearly'; return `<button type="button" class="t ${cls}" style="border:0;cursor:pointer" data-go="#table/${t}">${t}s<br><small>${s.fluent}/${s.total}</small></button>`; }).join('')}
      </div>
    </div>
    <div class="card stack" style="margin-top:14px">
      <h2>Test Simulation scores</h2>
      ${checks.length >= 2 ? scoreChart(checks) : `<p class="muted">${checks.length === 1 ? `First test: ${checks[0].score}/25. Do another to see your line go up!` : 'Do a Test Simulation to start your chart.'}</p>`}
      ${checks.length ? `<div class="row"><span class="chip plain">Best ${store.bestCheck(profile.id)}/25</span><span class="chip plain">Latest ${checks.slice(-1)[0].score}/25</span><span class="chip plain">${checks.length} test${checks.length > 1 ? 's' : ''}</span></div>` : ''}
    </div>
    <div class="card stack" style="margin-top:14px">
      <h2>Badges (${rewards.badges.length}/${BADGES.length})</h2>
      <div class="badge-shelf">
        ${BADGES.map((b) => `<div class="badge ${rewards.badges.includes(b.id) ? '' : 'locked'}" title="${esc(b.description)}"><span class="e">${b.emoji}</span>${esc(b.name)}</div>`).join('')}
      </div>
    </div>
    <div class="row center" style="margin-top:18px"><button type="button" class="btn good" data-go="#practice">Practice 🎯</button></div>`;

  el.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) return navigate(go.dataset.go);
    const cell = e.target.closest('.cell[data-key]');
    if (!cell) return;
    el.querySelectorAll('.cell.sel').forEach((c) => c.classList.remove('sel'));
    cell.classList.add('sel');
    const key = cell.dataset.key;
    const [a, b] = key.split('x');
    const e2 = effective(facts, key);
    const f = facts[key];
    const detail = el.querySelector('[data-detail]');
    const label = e2.status === 'unknown' && f?.n ? 'Just getting started' : STATUS_LABEL[e2.status];
    let text = `<b>${a} × ${b} = ${a * b}</b> — ${label}`;
    if (f && f.n) text += `. Tried ${f.n} time${f.n > 1 ? 's' : ''}, ${f.correct} right`;
    if (f && f.ewmaMs != null && f.n >= 2) text += `, about ${formatSeconds(f.ewmaMs)}`;
    if (e2.derived) text += ` (guessed from ${b} × ${a})`;
    detail.innerHTML = text;
  });
}
