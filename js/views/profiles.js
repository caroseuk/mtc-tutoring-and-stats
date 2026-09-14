import { AVATARS, COLOURS } from '../store.js';
import { esc } from '../util.js';

export function render(el, { store, navigate }) {
  let adding = store.profiles().length === 0;
  let avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
  let colour = COLOURS[Math.floor(Math.random() * COLOURS.length)];

  function draw() {
    el.innerHTML = `
      <div class="hero"><h1>Who's playing? 🚀</h1><p class="muted">Tap your name to start</p></div>
      <div class="profile-grid">
        ${store.profiles().map((p) => `
          <button type="button" class="profile-tile" data-id="${p.id}" style="--pc:${esc(p.colour)}33">
            <span class="av" style="--pc:${esc(p.colour)}33">${esc(p.avatar)}</span><span>${esc(p.name)}</span>
          </button>`).join('')}
        <button type="button" class="profile-tile add" data-act="add"><span class="av">➕</span><span>Add a child</span></button>
      </div>
      <form class="card stack" data-form ${adding ? '' : 'hidden'}>
        <h2>New player</h2>
        <label class="field">Name <input class="input" name="name" maxlength="20" autocomplete="off" placeholder="Your name" required></label>
        <div class="field">Pick a character
          <div class="picker" data-avatars>${AVATARS.map((a) => `<button type="button" data-av="${a}" class="${a === avatar ? 'on' : ''}">${a}</button>`).join('')}</div>
        </div>
        <div class="field">Pick a colour
          <div class="picker" data-colours>${COLOURS.map((c) => `<button type="button" class="swatch ${c === colour ? 'on' : ''}" data-col="${c}" style="background:${c}" aria-label="colour"></button>`).join('')}</div>
        </div>
        <div class="row"><button type="submit" class="btn good">Let's go! 🎉</button>${store.profiles().length ? '<button type="button" class="btn ghost" data-act="cancel">Cancel</button>' : ''}</div>
      </form>
      <div class="footer-links"><a href="#grownups">Grown-ups</a></div>`;
  }
  draw();

  el.addEventListener('click', (e) => {
    const tile = e.target.closest('.profile-tile[data-id]');
    if (tile) { store.setActive(tile.dataset.id); navigate('#home'); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'add') { adding = true; el.querySelector('[data-form]').hidden = false; el.querySelector('input[name=name]').focus(); }
    if (act === 'cancel') { adding = false; el.querySelector('[data-form]').hidden = true; }
    const av = e.target.closest('[data-av]');
    if (av) { avatar = av.dataset.av; el.querySelectorAll('[data-av]').forEach((b) => b.classList.toggle('on', b === av)); }
    const col = e.target.closest('[data-col]');
    if (col) { colour = col.dataset.col; el.querySelectorAll('[data-col]').forEach((b) => b.classList.toggle('on', b === col)); }
  });
  el.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = el.querySelector('input[name=name]').value.trim();
    if (!name) return;
    const p = store.addProfile({ name, avatar, colour });
    store.setActive(p.id);
    navigate('#home');
  });
}
