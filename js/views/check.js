// The Test Simulation: an official-style replica of the MTC.
import { generateCheck, generateWarmup, SECONDS_PER_QUESTION, PAUSE_SECONDS, TOTAL } from '../mtc.js';
import { runSession } from '../session.js';

export function render(el, { store, profile, navigate, audio, announce, shared }) {
  let session = null;
  el.innerHTML = `
    <div class="card stack" style="margin:auto; max-width:520px; text-align:center">
      <h1>📝 Test Simulation</h1>
      <p>This is just like the real thing:</p>
      <ul style="text-align:left; margin:0 auto; max-width:360px; font-weight:800">
        <li>3 practice questions first</li>
        <li>then <b>${TOTAL} questions</b></li>
        <li><b>${SECONDS_PER_QUESTION} seconds</b> to answer each one</li>
        <li>a ${PAUSE_SECONDS} second breather between questions</li>
        <li>press <b>Enter</b> when you've typed your answer</li>
      </ul>
      <button type="button" class="btn accent big" data-act="start">I'm ready! 🚀</button>
      <button type="button" class="btn ghost small" data-act="back">Back</button>
    </div>`;

  el.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'back') return navigate('#home');
    if (act !== 'start' || session) return;
    session = runSession(el, {
      questions: generateCheck(),
      warmup: generateWarmup(),
      seconds: SECONDS_PER_QUESTION,
      pause: PAUSE_SECONDS,
      feedback: false,
      theme: 'plain',
      audio: null, // the real check is silent
      announce,
    });
    const out = await session.promise;
    session = null;
    if (!out) return navigate('#home');
    const res = store.recordSession(profile.id, { type: 'check', ...out });
    shared.lastResult = res;
    if (res.newBadges.length) audio.fanfare();
    navigate(`#results/${res.session.id}`);
  });

  return () => { if (session) session.abort(); };
}
