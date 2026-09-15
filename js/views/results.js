import { esc, formatSeconds } from '../util.js';
import { weakest } from '../adaptive.js';
import { badgeById } from '../rewards.js';

const MESSAGES = [
  [1.0, '🏆 Perfect! Amazing!'],
  [0.9, '🌟 Brilliant work!'],
  [0.8, '🎉 Great job!'],
  [0.6, '💪 Good going, keep it up!'],
  [0.4, "👍 Nice try, you're learning!"],
  [0, '🌱 Every go makes you stronger!'],
];

export function confetti(el, n = 60) {
  const box = document.createElement('div');
  box.className = 'confetti';
  const colours = ['#7c4dff', '#ff6d00', '#22c55e', '#ff4081', '#ffc400', '#2979ff'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colours[i % colours.length];
    p.style.animationDuration = 2 + Math.random() * 2 + 's';
    p.style.animationDelay = Math.random() * 0.8 + 's';
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.appendChild(p);
  }
  el.appendChild(box);
  setTimeout(() => box.remove(), 5000);
}

export function render(el, { store, profile, navigate, shared, params }) {
  const session = store.sessions(profile.id).find((s) => s.id === params[0]);
  if (!session) { navigate('#home'); return; }
  const res = shared.lastResult?.session?.id === session.id ? shared.lastResult : null;
  const ratio = session.total ? session.score / session.total : 0;
  const msg = MESSAGES.find(([t]) => ratio >= t)[1];
  const isCheck = session.type === 'check';
  const prevChecks = store.checks(profile.id).filter((s) => s.id !== session.id);
  const prev = prevChecks.slice(-1)[0];
  const prevBest = prevChecks.reduce((m, s) => Math.max(m, s.score), -1);
  const newBest = isCheck && prevBest >= 0 && session.score > prevBest;
  const retries = session.questions.filter((q) => q.retry);
  const wrongHere = [...new Map(session.questions.filter((q) => !q.correct).map((q) => [`${q.a}x${q.b}`, q])).values()];
  const weakModel = weakest(store.facts(profile.id), 4).filter((w) => !wrongHere.some((q) => q.a === w.a && q.b === w.b));
  const weak = [...wrongHere, ...weakModel].slice(0, 4);

  el.innerHTML = `
    <div class="card score-hero">
      <div class="muted" style="font-weight:800">${isCheck ? 'Test Simulation' : session.type === 'table' ? `The ${session.table}s` : 'Practice round'}</div>
      <div class="score">${session.score}<small> / ${session.total}</small></div>
      <div class="msg">${msg}</div>
      ${newBest ? '<div class="chip warn" style="margin-top:8px">🥇 New personal best!</div>' : ''}
      ${isCheck && prev ? `<p class="muted" style="margin-top:8px">Last time: ${prev.score}/25 ${session.score > prev.score ? '📈' : session.score < prev.score ? '📉' : '➡️'}</p>` : ''}
      <div class="earned">
        ${res ? `<span class="chip warn">+${res.starsEarned} ⭐</span>` : ''}
        ${session.avgMs != null ? `<span class="chip plain">⏱️ ${formatSeconds(session.avgMs)} average</span>` : ''}
        ${res?.newlyFluent ? `<span class="chip ok">🧠 ${res.newlyFluent} new fluent question${res.newlyFluent > 1 ? 's' : ''}</span>` : ''}
        ${retries.length ? `<span class="chip plain">🔁 ${retries.filter((q) => q.correct).length}/${retries.length} retries right</span>` : ''}
      </div>
      ${res?.newBadges.length ? `<div class="earned">${res.newBadges.map((id) => { const b = badgeById(id); return `<span class="badge-new">${b.emoji} ${esc(b.name)}</span>`; }).join('')}</div>` : ''}
    </div>
    <div class="card" style="margin-top:14px">
      <h3>Your answers</h3>
      <div class="qgrid">
        ${session.questions.map((q) => `<span class="chip ${q.correct ? 'ok' : 'bad'}">${q.a}×${q.b} ${q.correct ? '✅' : `❌ <small>${q.given == null ? 'no answer' : q.given} → ${q.answer}</small>`}${q.correct && q.ms != null ? ` <small>${formatSeconds(q.ms)}</small>` : ''}</span>`).join('')}
      </div>
    </div>
    ${weak.length ? `<div class="card" style="margin-top:14px"><h3>Questions to work on</h3><div class="qgrid">${weak.map((w) => `<span class="chip warn">${w.a} × ${w.b} = ${w.a * w.b}</span>`).join('')}</div></div>` : ''}
    <div class="row center" style="margin-top:18px">
      <button type="button" class="btn good" data-go="${isCheck ? '#practice' : `#${session.type === 'table' ? `table/${session.table}` : 'practice'}`}">${isCheck ? 'Work on the tricky ones 🎯' : 'Play again 🔁'}</button>
      <button type="button" class="btn ghost" data-go="#home">Home 🏠</button>
    </div>`;

  if (newBest || res?.newBadges.length || ratio === 1) confetti(el);
  el.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) navigate(go.dataset.go);
  });
}
