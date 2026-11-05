(function () {
  'use strict';
  const KEY = 'hub-appearance';
  const COLORS = { meadow: '#eef3ea', forest: '#14231a' };
  const SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const MOON = '<svg viewBox="0 0 24 24"><path class="fill" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';

  const get = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; } };
  const darkQuery = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  const isDark = () => { const a = get(); return a === 'dark' || (a === 'auto' && !!(darkQuery && darkQuery.matches)); };

  function paint() {
    const theme = isDark() ? 'forest' : 'meadow';
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').setAttribute('content', COLORS[theme]);
    const btn = document.getElementById('modeBtn');
    btn.innerHTML = isDark() ? SUN : MOON;
    btn.setAttribute('aria-label', isDark() ? 'Switch to light mode' : 'Switch to dark mode');
  }
  document.getElementById('modeBtn').onclick = () => {
    try { localStorage.setItem(KEY, isDark() ? 'light' : 'dark'); } catch (e) {}
    paint();
  };
  if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', paint);
  paint();

  const h = new Date().getHours();
  document.getElementById('hello').textContent = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const list = document.getElementById('list');

  fetch('games.json', { cache: 'no-cache' })
    .then((r) => r.json())
    .then((data) => {
      const games = (data && data.games) || [];
      if (!games.length) { list.innerHTML = '<p class="note">No games yet.</p>'; return; }
      list.innerHTML = games.map((g) => {
        const folder = encodeURIComponent(g.folder);
        const icon = g.icon || (g.folder + '/icons/icon-192.png');
        return '<a class="game" href="' + folder + '/">' +
          '<img src="' + esc(icon) + '" alt="">' +
          '<span class="text"><b>' + esc(g.name) + '</b><small>' + esc(g.tagline || '') + '</small></span>' +
          '<span class="play" aria-hidden="true">Play</span></a>';
      }).join('');
    })
    .catch(() => { list.innerHTML = '<p class="note">Couldn\'t load the game list. Check your connection and reopen.</p>'; });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
