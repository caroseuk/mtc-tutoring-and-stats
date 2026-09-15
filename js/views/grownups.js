// Detailed stats, backup and settings. Behind a simple sum so children stay out.
import { esc, formatSeconds, formatDateTime, mean } from '../util.js';
import { FACT_KEYS, parseKey, effective, summarize, fluency, status } from '../adaptive.js';
import { AVATARS, COLOURS } from '../store.js';
import { scoreChart } from './progress.js';

const GATE_KEY = 'mtc:grownup';
const STATUS_COLOUR = { unknown: 'var(--unknown)', learning: 'var(--learning)', nearly: 'var(--nearly)', fluent: 'var(--fluent)' };
const STATUS_LABEL = { unknown: 'Not tried', learning: 'Learning', nearly: 'Nearly', fluent: 'Fluent' };

function gateOpen() { try { return sessionStorage.getItem(GATE_KEY) === '1'; } catch { return false; } }
function openGate() { try { sessionStorage.setItem(GATE_KEY, '1'); } catch { /* ignore */ } }

export function render(el, { store, navigate }) {
  if (!gateOpen()) return renderGate(el, { store, navigate });
  let selectedId = store.activeProfile()?.id || store.profiles()[0]?.id || null;
  let sort = { col: 'fluency', dir: 1 };
  let showAll = false;
  let notice = '';

  function factRows(facts) {
    return FACT_KEYS.map((key) => {
      const { a, b } = parseKey(key);
      const f = facts[key];
      const e = effective(facts, key);
      return { key, a, b, n: f?.n || 0, correct: f?.correct || 0, acc: f?.n ? f.correct / f.n : null, ms: f?.n >= 2 ? f.ewmaMs : null, fluency: e.fluency, status: e.status, derived: e.derived, seen: (f?.n || 0) > 0 };
    });
  }

  function draw() {
    const profiles = store.profiles();
    const p = store.profile(selectedId);
    const facts = p ? store.facts(p.id) : {};
    const sessions = p ? store.sessions(p.id) : [];
    const checks = sessions.filter((s) => s.type === 'check');
    const sum = summarize(facts);
    let rows = factRows(facts).filter((r) => showAll || r.seen || r.derived);
    const val = (r) => (sort.col === 'fact' ? r.a * 100 + r.b : r[sort.col] ?? (sort.dir === 1 ? Infinity : -Infinity));
    rows.sort((x, y) => (val(x) - val(y)) * sort.dir);
    const recentAvg = mean(checks.slice(-3).map((s) => s.avgMs).filter((x) => x != null));
    const th = (col, label, num = false) => `<th class="${num ? 'num' : ''} ${sort.col === col ? 'on' : ''}" data-sort="${col}">${label}${sort.col === col ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</th>`;

    el.innerHTML = `
      <div class="topbar">
        <button type="button" class="btn ghost small" data-go="${store.activeProfile() ? '#home' : '#profiles'}">← Back</button>
        <h2 style="margin:0">Grown-ups</h2>
      </div>
      ${notice ? `<div class="notice ${notice.startsWith('!') ? 'err' : ''}" style="margin-bottom:12px">${esc(notice.replace(/^!/, ''))}</div>` : ''}
      <div class="card stack">
        <h3>Child</h3>
        <div class="row">
          ${profiles.map((x) => `<button type="button" class="chip btn-chip ${x.id === selectedId ? 'on' : ''}" data-select="${x.id}">${esc(x.avatar)} ${esc(x.name)}</button>`).join('') || '<span class="muted">No children yet. Add one from the start screen, or import a backup below.</span>'}
        </div>
      </div>
      ${p ? `
      <div class="summary" style="margin-top:14px">
        <div class="card"><div class="big">${checks.length}</div><div class="lbl">Test Simulations</div></div>
        <div class="card"><div class="big">${checks.length ? store.bestCheck(p.id) + '/25' : '–'}</div><div class="lbl">Best score</div></div>
        <div class="card"><div class="big">${checks.length ? checks.slice(-1)[0].score + '/25' : '–'}</div><div class="lbl">Latest score</div></div>
        <div class="card"><div class="big">${recentAvg != null ? formatSeconds(recentAvg) : '–'}</div><div class="lbl">Avg answer time (last 3 tests)</div></div>
        <div class="card"><div class="big">${sessions.length}</div><div class="lbl">Rounds played</div></div>
        <div class="card"><div class="big">${sum.fluent}/${sum.totalFacts}</div><div class="lbl">Fluent questions</div></div>
      </div>
      <div class="card stack" style="margin-top:14px">
        <h3>Test Simulation scores</h3>
        ${checks.length >= 2 ? scoreChart(checks) : '<p class="muted">Two or more tests are needed for a chart.</p>'}
      </div>
      <div class="card stack" style="margin-top:14px">
        <h3>Questions (${rows.length}${showAll ? '' : ' seen'})</h3>
        <p class="muted" style="margin:0">Fluency blends accuracy (60%) and speed (40%). Under 2.5s is full speed marks, 6s or a timeout is zero. Aim for questions to be answered in under 3 seconds, leaving time to type on the day.</p>
        <label class="toggle"><span>Show all 121 questions</span><input type="checkbox" data-showall ${showAll ? 'checked' : ''}></label>
        <div class="scroll-x"><table class="data">
          <thead><tr>${th('fact', 'Question')}${th('status', 'Status')}${th('fluency', 'Fluency', true)}${th('ms', 'Avg time', true)}${th('acc', 'Accuracy', true)}${th('n', 'Tries', true)}</tr></thead>
          <tbody>${rows.map((r) => `<tr>
            <td><b>${r.a} × ${r.b}</b> = ${r.a * r.b}</td>
            <td><span class="status-dot" style="background:${STATUS_COLOUR[r.status]}"></span>${STATUS_LABEL[r.status]}${r.derived ? ' <small class="muted">(from reverse)</small>' : ''}</td>
            <td class="num">${r.fluency == null ? '–' : Math.round(r.fluency * 100) + '%'}</td>
            <td class="num">${r.ms == null ? '–' : formatSeconds(r.ms)}</td>
            <td class="num">${r.acc == null ? '–' : Math.round(r.acc * 100) + '%'}</td>
            <td class="num">${r.n}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>
      <div class="card stack" style="margin-top:14px">
        <details><summary>Round history (${sessions.length})</summary>
          <div class="scroll-x"><table class="data">
            <thead><tr><th>When</th><th>Type</th><th class="num">Score</th><th class="num">Avg time</th></tr></thead>
            <tbody>${sessions.slice().reverse().slice(0, 100).map((s) => `<tr><td>${formatDateTime(s.endedAt)}</td><td>${s.type === 'check' ? 'Test Simulation' : s.type === 'table' ? `${s.table}s` : 'Practice'}</td><td class="num">${s.score}/${s.total}</td><td class="num">${s.avgMs == null ? '–' : formatSeconds(s.avgMs)}</td></tr>`).join('')}</tbody>
          </table></div>
        </details>
      </div>
      <div class="card stack" style="margin-top:14px">
        <h3>Settings for ${esc(p.name)}</h3>
        <label class="toggle"><span>Sounds in practice rounds</span><input type="checkbox" data-sound ${p.settings.sound !== false ? 'checked' : ''}></label>
        <label class="field">Name <input class="input" data-name value="${esc(p.name)}" maxlength="20"></label>
        <div class="field">Character <div class="picker">${AVATARS.map((a) => `<button type="button" data-av="${a}" class="${a === p.avatar ? 'on' : ''}">${a}</button>`).join('')}</div></div>
        <div class="field">Colour <div class="picker">${COLOURS.map((c) => `<button type="button" class="swatch ${c === p.colour ? 'on' : ''}" data-col="${c}" style="background:${c}" aria-label="colour"></button>`).join('')}</div></div>
      </div>` : ''}
      <div class="card stack" style="margin-top:14px">
        <h3>Backup</h3>
        <p class="muted" style="margin:0">Progress is stored in this browser only. Export a backup now and again, and to move to another device.</p>
        <div class="row">
          <button type="button" class="btn small" data-act="export" ${profiles.length ? '' : 'disabled'}>Export backup</button>
          <label class="btn small ghost">Import backup <input type="file" accept="application/json,.json" data-import hidden></label>
        </div>
      </div>
      ${p ? `
      <div class="card stack" style="margin-top:14px">
        <h3>Danger zone</h3>
        <div class="row" data-danger>
          <button type="button" class="btn small ghost" data-act="reset">Reset ${esc(p.name)}'s progress</button>
          <button type="button" class="btn small ghost" data-act="delete">Delete ${esc(p.name)}</button>
        </div>
      </div>` : ''}
      <div class="footer-links"><small class="muted">Beat Six · practice for the Year 4 Multiplication Tables Check</small></div>`;
  }
  draw();

  function confirmAction(label, fn) {
    const zone = el.querySelector('[data-danger]');
    zone.innerHTML = `<span style="font-weight:800">${esc(label)} This can't be undone.</span><button type="button" class="btn small danger" data-act="confirm">Yes, do it</button><button type="button" class="btn small ghost" data-act="cancel">Cancel</button>`;
    zone.onclick = (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'confirm') { fn(); notice = 'Done.'; }
      if (act === 'confirm' || act === 'cancel') { zone.onclick = null; draw(); }
    };
  }

  el.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) return navigate(go.dataset.go);
    const sel = e.target.closest('[data-select]');
    if (sel) { selectedId = sel.dataset.select; notice = ''; return draw(); }
    const sortTh = e.target.closest('[data-sort]');
    if (sortTh) { const col = sortTh.dataset.sort; sort = { col, dir: sort.col === col ? -sort.dir : 1 }; return draw(); }
    const av = e.target.closest('[data-av]');
    if (av) { store.updateProfile(selectedId, { avatar: av.dataset.av }); return draw(); }
    const col = e.target.closest('[data-col]');
    if (col) { store.updateProfile(selectedId, { colour: col.dataset.col }); return draw(); }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'export') return exportBackup();
    if (act === 'reset') return confirmAction(`Reset all progress for ${store.profile(selectedId).name}?`, () => store.resetProfile(selectedId));
    if (act === 'delete') return confirmAction(`Delete ${store.profile(selectedId).name} and all their progress?`, () => { store.deleteProfile(selectedId); selectedId = store.profiles()[0]?.id || null; });
  });
  el.addEventListener('change', (e) => {
    if (e.target.matches('[data-showall]')) { showAll = e.target.checked; return draw(); }
    if (e.target.matches('[data-sound]')) { store.updateProfile(selectedId, { settings: { sound: e.target.checked } }); return; }
    if (e.target.matches('[data-name]')) { const name = e.target.value.trim(); if (name) store.updateProfile(selectedId, { name }); return draw(); }
    if (e.target.matches('[data-import]')) importBackup(e.target.files[0]);
  });

  function exportBackup() {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `beat-six-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    notice = 'Backup exported.';
    draw();
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const n = store.importJSON(String(reader.result));
        selectedId = store.activeProfile()?.id || store.profiles()[0]?.id || null;
        notice = `Imported ${n} child${n === 1 ? '' : 'ren'}.`;
      } catch (err) {
        notice = '!' + (err.message || 'Import failed');
      }
      draw();
    };
    reader.readAsText(file);
  }
}

function renderGate(el, { store, navigate }) {
  const a = 11 + Math.floor(Math.random() * 9); // 11-19
  const b = 3 + Math.floor(Math.random() * 7);  // 3-9
  el.innerHTML = `
    <div class="card stack gate">
      <h1>🔒 Grown-ups only</h1>
      <p>Quick sum to get in: <b>${a} × ${b} = ?</b></p>
      <form data-gate class="stack"><input class="input" inputmode="numeric" name="ans" autocomplete="off" style="text-align:center;font-size:1.6rem"><button type="submit" class="btn">Open</button></form>
      <button type="button" class="btn ghost small" data-go="${store.activeProfile() ? '#home' : '#profiles'}">Back</button>
    </div>`;
  el.querySelector('input').focus();
  el.addEventListener('click', (e) => { const go = e.target.closest('[data-go]'); if (go) navigate(go.dataset.go); });
  el.addEventListener('submit', (e) => {
    e.preventDefault();
    if (Number(el.querySelector('input').value) === a * b) { openGate(); render(el, { store, navigate }); }
    else { el.querySelector('input').value = ''; el.querySelector('input').placeholder = 'Not quite, try again'; }
  });
}
