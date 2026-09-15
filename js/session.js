// The question runner shared by every mode. Renders into a container and
// resolves with the answers when the round is over (or null if stopped).
//
// runSession(container, {
//   questions: [{a, b}], warmup: [{a, b}], seconds: 6, pause: 3,
//   feedback: false,   // show tick/cross + the right answer during the pause
//   retryWrong: false, // re-ask a missed fact a few questions later
//   theme: 'fun' | 'plain', audio, announce
// }) -> { promise, abort }

import { esc } from './util.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'enter'];

export function runSession(container, opts) {
  const o = { warmup: [], seconds: 6, pause: 3, feedback: false, retryWrong: false, maxRetries: 5, theme: 'fun', audio: null, announce: () => {}, ...opts };
  const queue = [...o.warmup.map((q) => ({ ...q, warmup: true })), ...o.questions.map((q) => ({ ...q }))];
  const results = [];
  const startedAt = Date.now();
  let index = 0;
  let retries = 0;
  let answer = '';
  let phase = 'idle'; // idle | question | pause | paused
  let deadline = 0;
  let qStart = 0;
  let raf = 0;
  let timer = 0;
  let pausedRemain = 0;
  let pausedPhase = null;
  let done = false;
  let resolveFn;
  const promise = new Promise((r) => { resolveFn = r; });

  container.innerHTML = `
    <div class="session theme-${esc(o.theme)}">
      <div class="session-top">
        <button class="quit" type="button" aria-label="Stop this round">✕</button>
        ${o.theme === 'fun' ? '<div class="dots" aria-hidden="true"></div>' : '<div class="qcount"></div>'}
      </div>
      <div class="session-body">
        <div class="q-area">
          <div class="banner" hidden></div>
          <div class="question" aria-live="off"><span class="a"></span><span class="op">×</span><span class="b"></span><span class="op">=</span></div>
          <div class="answer-box" aria-label="Your answer"></div>
          <div class="timer" role="presentation"><div class="timer-fill"></div></div>
          <div class="feedback" hidden></div>
          <div class="getready" hidden>Get ready…</div>
        </div>
        <div class="numpad" role="group" aria-label="Number pad">
          ${KEYS.map((k) => `<button type="button" class="key ${k === 'del' ? 'del' : k === 'enter' ? 'enter' : ''}" data-key="${k}" aria-label="${k === 'del' ? 'Delete' : k === 'enter' ? 'Enter' : k}">${k === 'del' ? '⌫' : k === 'enter' ? 'Enter' : k}</button>`).join('')}
        </div>
      </div>
    </div>`;

  const $ = (s) => container.querySelector(s);
  const el = {
    root: $('.session'), quit: $('.quit'), dots: $('.dots'), count: $('.qcount'), qArea: $('.q-area'),
    banner: $('.banner'), a: $('.a'), b: $('.b'), answer: $('.answer-box'), timer: $('.timer'),
    fill: $('.timer-fill'), feedback: $('.feedback'), ready: $('.getready'), pad: $('.numpad'),
  };

  function buildDots() {
    if (!el.dots) return;
    el.dots.innerHTML = queue.filter((q) => !q.warmup).map(() => '<span class="dot"></span>').join('');
    results.forEach((r, i) => { if (el.dots.children[i]) el.dots.children[i].className = 'dot ' + (r.correct ? 'ok' : 'bad'); });
  }

  function updateCounter() {
    const q = queue[index];
    if (el.count) {
      const scored = queue.filter((x) => !x.warmup);
      if (q.warmup) el.count.textContent = `Practice question ${index + 1} of ${queue.filter((x) => x.warmup).length}`;
      else el.count.textContent = `Question ${scored.indexOf(q) + 1} of ${scored.length}`;
    }
    if (el.dots) {
      const n = results.length;
      [...el.dots.children].forEach((d, i) => d.classList.toggle('now', i === n && !q.warmup));
    }
  }

  function showQuestion() {
    if (done) return;
    if (index >= queue.length) return finish();
    const q = queue[index];
    answer = '';
    el.a.textContent = q.a;
    el.b.textContent = q.b;
    el.answer.textContent = '';
    el.answer.className = 'answer-box';
    el.banner.textContent = q.warmup ? 'Practice question' : q.retry ? 'Try again!' : '';
    el.banner.hidden = !el.banner.textContent;
    el.feedback.hidden = true;
    el.ready.hidden = true;
    el.qArea.classList.remove('blank');
    el.timer.classList.remove('low');
    el.fill.style.transform = 'scaleX(1)';
    updateCounter();
    o.announce(`${q.a} times ${q.b}`);
    qStart = performance.now();
    deadline = qStart + o.seconds * 1000;
    phase = 'question';
    raf = requestAnimationFrame(tick);
  }

  function tick() {
    if (phase !== 'question') return;
    const remain = Math.max(0, deadline - performance.now());
    el.fill.style.transform = `scaleX(${remain / (o.seconds * 1000)})`;
    el.timer.classList.toggle('low', remain < 2000);
    if (remain <= 0) return submit(true);
    raf = requestAnimationFrame(tick);
  }

  function input(key) {
    if (phase !== 'question') return;
    if (key === 'enter') return submit(false);
    if (key === 'del') answer = answer.slice(0, -1);
    else if (/^\d$/.test(key) && answer.length < 3) answer += key;
    el.answer.textContent = answer;
    o.audio?.tap();
  }

  function submit(timedOut) {
    if (phase !== 'question') return;
    phase = 'pause';
    cancelAnimationFrame(raf);
    const q = queue[index];
    const elapsed = Math.round(performance.now() - qStart);
    const given = answer === '' ? null : Number(answer);
    const correct = given === q.a * q.b;
    const ms = given == null ? null : timedOut ? o.seconds * 1000 : Math.min(elapsed, o.seconds * 1000);
    const rec = { a: q.a, b: q.b, answer: q.a * q.b, given, correct, ms, retry: !!q.retry };
    if (!q.warmup) {
      results.push(rec);
      if (o.retryWrong && !correct && !q.retry && retries < o.maxRetries) {
        retries++;
        queue.splice(Math.min(index + 3, queue.length), 0, { ...q, retry: true });
      }
      buildDots();
    }
    el.fill.style.transform = 'scaleX(0)';
    if (o.feedback) showFeedback(rec);
    else el.qArea.classList.add('blank'); // the real test goes blank between questions
    index++;
    timer = setTimeout(showQuestion, o.pause * 1000);
  }

  function showFeedback(rec) {
    el.feedback.hidden = false;
    if (rec.correct) {
      el.feedback.className = 'feedback ok';
      el.feedback.textContent = `✅ ${rec.ms < 3000 ? '⚡ Super quick! ' : 'Yes! '}${(rec.ms / 1000).toFixed(1)}s`;
      el.answer.classList.add('right');
      o.audio?.correct();
    } else {
      el.feedback.className = 'feedback bad';
      el.feedback.innerHTML = `${rec.given == null ? '⏰ Too slow! ' : '❌ '}${rec.a} × ${rec.b} = <b>${rec.answer}</b>`;
      el.answer.textContent = rec.given == null ? '–' : String(rec.given);
      el.answer.classList.add('wrong');
      o.audio?.wrong();
    }
    o.announce(rec.correct ? 'Correct' : `Wrong. ${rec.a} times ${rec.b} is ${rec.answer}`);
  }

  // ---- pausing (quit dialog, tab hidden) ----
  function pause() {
    if (phase === 'question') {
      pausedRemain = Math.max(0, deadline - performance.now());
      cancelAnimationFrame(raf);
      pausedPhase = 'question';
    } else if (phase === 'pause') {
      clearTimeout(timer);
      pausedPhase = 'pause';
    } else return;
    phase = 'paused';
  }

  function resume({ restart = false } = {}) {
    if (phase !== 'paused') return;
    if (pausedPhase === 'question') {
      if (restart) { index; showQuestion(); return; }
      qStart = performance.now() - (o.seconds * 1000 - pausedRemain);
      deadline = performance.now() + pausedRemain;
      phase = 'question';
      raf = requestAnimationFrame(tick);
    } else {
      phase = 'pause';
      timer = setTimeout(showQuestion, 600);
    }
  }

  function onVisibility() {
    if (document.hidden) pause();
    else resume({ restart: true });
  }

  function showQuitDialog() {
    if (done || el.root.querySelector('.overlay')) return;
    pause();
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="card stack"><h2>Stop this round?</h2><button type="button" class="btn good block" data-act="keep">Keep going 💪</button><button type="button" class="btn ghost block" data-act="stop">Stop</button></div>`;
    ov.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      ov.remove();
      if (act === 'stop') abort();
      else resume();
    });
    el.root.appendChild(ov);
  }

  // ---- input wiring ----
  function onPointer(e) {
    const b = e.target.closest('button[data-key]');
    if (!b || !e.isPrimary) return;
    e.preventDefault();
    b.classList.add('pressed');
    setTimeout(() => b.classList.remove('pressed'), 90);
    input(b.dataset.key);
  }
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    let k = null;
    if (/^[0-9]$/.test(e.key)) k = e.key;
    else if (e.key === 'Backspace') k = 'del';
    else if (e.key === 'Enter') k = 'enter';
    else if (e.key === 'Escape') { showQuitDialog(); return; }
    if (!k) return;
    e.preventDefault();
    input(k);
  }
  if (o.theme === 'plain') document.body.classList.add('plain-bg');
  el.pad.addEventListener('pointerdown', onPointer);
  el.pad.addEventListener('contextmenu', (e) => e.preventDefault());
  el.quit.addEventListener('click', showQuitDialog);
  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);

  function cleanup() {
    done = true;
    document.body.classList.remove('plain-bg');
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
  }
  function finish() {
    cleanup();
    resolveFn({ questions: results, startedAt, secondsPerQuestion: o.seconds });
  }
  function abort() {
    if (done) return;
    cleanup();
    resolveFn(null);
  }

  // Get ready, then go.
  buildDots();
  el.qArea.classList.add('blank');
  el.ready.hidden = false;
  el.ready.style.visibility = 'visible';
  phase = 'pause';
  o.audio?.go();
  timer = setTimeout(showQuestion, 1500);

  return { promise, abort };
}
