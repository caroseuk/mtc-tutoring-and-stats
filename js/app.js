// Bootstrap and hash router.

import { createStore } from './store.js';
import { createAudio } from './audio.js';
import * as profiles from './views/profiles.js';
import * as home from './views/home.js';
import * as check from './views/check.js';
import * as practice from './views/practice.js';
import * as results from './views/results.js';
import * as progress from './views/progress.js';
import * as grownups from './views/grownups.js';

const store = createStore();
const audio = createAudio();
const shared = { lastResult: null }; // in-memory bag passed between views
const routes = { profiles, home, check, practice, table: practice, results, progress, grownups };
const noProfileOk = new Set(['profiles', 'grownups']);
let cleanup = null;

function navigate(hash) { location.hash = hash; }
function announce(text) { const l = document.getElementById('live'); if (l) l.textContent = text; }

function parseRoute() {
  const [name, ...params] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: name || 'home', params };
}

function render() {
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  const { name, params } = parseRoute();
  const profile = store.activeProfile();
  if (!profile && !noProfileOk.has(name)) { location.replace('#profiles'); return; }
  if (!routes[name]) { location.replace('#home'); return; }
  audio.enabled = profile ? profile.settings.sound !== false : true;
  const app = document.getElementById('app');
  const el = document.createElement('div');
  el.className = 'view view-' + name;
  app.replaceChildren(el);
  app.className = 'app view-' + name;
  window.scrollTo(0, 0);
  const r = routes[name].render(el, { store, audio, navigate, announce, shared, profile, route: name, params });
  if (typeof r === 'function') cleanup = r;
}

document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
}
window.addEventListener('hashchange', render);
render();
