/* Tama's icon set (MUS-2, D-078): one consistent 24x24 line-icon family drawn for Tama, colored by the theme
   (currentColor). Injected once as an inline SVG sprite, used as <svg class="i"><use href="#i-play"/></svg>.
   Static markup only: no page data ever goes through here. */
(function () {
  const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const F = 'fill="currentColor" stroke="none"';
  const ICONS = {
    play: `<path ${F} d="M8.5 5.2v13.6a1 1 0 0 0 1.5.86l10.6-6.8a1 1 0 0 0 0-1.72L10 4.34a1 1 0 0 0-1.5.86z"/>`,
    pause: `<rect ${F} x="6.2" y="5" width="4.2" height="14" rx="1.4"/><rect ${F} x="13.6" y="5" width="4.2" height="14" rx="1.4"/>`,
    prev: `<path ${S} d="M5.5 5.5v13"/><path ${F} d="M18.5 6.3v11.4a.9.9 0 0 1-1.4.74l-8.3-5.7a.9.9 0 0 1 0-1.48l8.3-5.7a.9.9 0 0 1 1.4.74z"/>`,
    next: `<path ${S} d="M18.5 5.5v13"/><path ${F} d="M5.5 6.3v11.4a.9.9 0 0 0 1.4.74l8.3-5.7a.9.9 0 0 0 0-1.48l-8.3-5.7a.9.9 0 0 0-1.4.74z"/>`,
    like: `<path ${S} d="M7 10.5v9H4.8A1.3 1.3 0 0 1 3.5 18.2v-6.4a1.3 1.3 0 0 1 1.3-1.3H7zm0 0 3.6-6.3a2 2 0 0 1 3.6 1.5l-.7 3.6h5a2 2 0 0 1 2 2.4l-1.3 6.3a2 2 0 0 1-2 1.5H7"/>`,
    dislike: `<g transform="rotate(180 12 12)"><path ${S} d="M7 10.5v9H4.8A1.3 1.3 0 0 1 3.5 18.2v-6.4a1.3 1.3 0 0 1 1.3-1.3H7zm0 0 3.6-6.3a2 2 0 0 1 3.6 1.5l-.7 3.6h5a2 2 0 0 1 2 2.4l-1.3 6.3a2 2 0 0 1-2 1.5H7"/></g>`,
    repeat: `<path ${S} d="M16.5 3 20 6.5 16.5 10"/><path ${S} d="M4 11.5V10a3.5 3.5 0 0 1 3.5-3.5H20"/><path ${S} d="M7.5 21 4 17.5 7.5 14"/><path ${S} d="M20 12.5V14a3.5 3.5 0 0 1-3.5 3.5H4"/>`,
    repeatOne: `<path ${S} d="M16.5 3 20 6.5 16.5 10"/><path ${S} d="M4 11.5V10a3.5 3.5 0 0 1 3.5-3.5H20"/><path ${S} d="M7.5 21 4 17.5 7.5 14"/><path ${S} d="M20 12.5V14a3.5 3.5 0 0 1-3.5 3.5H4"/><path ${S} stroke-width="1.8" d="M11 10.6 12.4 9.8v4.6"/>`,
    shuffle: `<path ${S} d="M16 3.5h4.5V8"/><path ${S} d="M4 19.5 20.5 3.5"/><path ${S} d="M20.5 16v4.5H16"/><path ${S} d="m14.5 14.5 6 6"/><path ${S} d="M4 4.5 9.5 10"/>`,
    volume: `<path ${F} d="M11.4 4.9 6.8 8.7H4.2a1 1 0 0 0-1 1v4.6a1 1 0 0 0 1 1h2.6l4.6 3.8a.6.6 0 0 0 1-.46V5.36a.6.6 0 0 0-1-.46z"/><path ${S} d="M15.8 9a4.5 4.5 0 0 1 0 6"/><path ${S} d="M18.6 6.2a8.5 8.5 0 0 1 0 11.6"/>`,
    mute: `<path ${F} d="M11.4 4.9 6.8 8.7H4.2a1 1 0 0 0-1 1v4.6a1 1 0 0 0 1 1h2.6l4.6 3.8a.6.6 0 0 0 1-.46V5.36a.6.6 0 0 0-1-.46z"/><path ${S} d="m16 9.5 5 5m0-5-5 5"/>`,
    down: `<path ${S} d="m6 9.5 6 6 6-6"/>`,
    up: `<path ${S} d="m6 14.5 6-6 6 6"/>`,
    close: `<path ${S} d="M6.5 6.5l11 11m0-11-11 11"/>`,
    pin: `<path ${S} d="M12 16.5V21"/><path ${S} d="M9 3.5h6l-.9 5.6 3.1 3v2.4H6.8v-2.4l3.1-3z"/>`,
    droplet: `<path ${S} d="M12 3.5s6 6.4 6 10.6a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z"/><path ${S} stroke-width="1.6" d="M9.2 14.6a2.9 2.9 0 0 0 2.4 2.6"/>`,
    note: `<path ${S} d="M9.5 17.5V6l10-2v11.5"/><circle ${F} cx="7" cy="17.5" r="2.6"/><circle ${F} cx="17" cy="15.5" r="2.6"/>`,
    queue: `<path ${S} d="M4 6.5h11M4 11.5h11M4 16.5h7"/><path ${F} d="M16 14.6v5.8a.5.5 0 0 0 .78.42l4.2-2.9a.5.5 0 0 0 0-.84l-4.2-2.9a.5.5 0 0 0-.78.42z"/>`,
    library: `<rect ${S} x="3.5" y="7.5" width="13" height="13" rx="2.5"/><path ${S} d="M7.5 4h10a3 3 0 0 1 3 3v10"/><path ${S} stroke-width="1.8" d="M11.5 16.8v-6l3-.8"/><circle ${F} cx="10" cy="16.8" r="1.7"/>`,
    search: `<circle ${S} cx="10.5" cy="10.5" r="6"/><path ${S} d="m15 15 5 5"/>`,
    back: `<path ${S} d="M14.5 6 8.5 12l6 6"/>`,
    heart: `<path ${S} d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10z"/>`,
    lyrics: `<path ${S} d="M4.5 6.5h15M4.5 11.5h10M4.5 16.5h6.5"/><path ${S} d="M18 13v5.2"/><circle ${F} cx="16.6" cy="18.6" r="1.8"/>`,
    // App chrome (D-078): Settings, setup and page headers use these instead of emoji.
    bow: `<path ${S} d="M12 11.5 5 7.5v8l7-4zm0 0 7-4v8l-7-4z"/><circle ${F} cx="12" cy="11.5" r="1.9"/><path ${S} d="m10.6 13.3-1.8 5.2m4.6-5.2 1.8 5.2"/>`,
    talk: `<path ${S} d="M5.5 5h13A2.5 2.5 0 0 1 21 7.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V17h-1A2.5 2.5 0 0 1 3 14.5v-7A2.5 2.5 0 0 1 5.5 5z"/><circle ${F} cx="8.5" cy="11" r="1.1"/><circle ${F} cx="12" cy="11" r="1.1"/><circle ${F} cx="15.5" cy="11" r="1.1"/>`,
    moon: `<path ${S} d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1z"/><path ${S} stroke-width="1.6" d="M17 4v3m-1.5-1.5h3"/>`,
    phone: `<rect ${S} x="6.5" y="2.8" width="11" height="18.4" rx="2.6"/><path ${S} d="M10.5 18h3"/>`,
    link: `<path ${S} d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path ${S} d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>`,
    sparkle: `<path ${S} d="M12 3.5c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.6 5.9-2.2 6.5-6.5z"/><path ${S} stroke-width="1.6" d="M18.5 16.5v4m-2-2h4"/>`,
    chart: `<path ${S} d="M4 20h16"/><rect ${S} x="5.5" y="11" width="3" height="6" rx="1"/><rect ${S} x="10.5" y="6.5" width="3" height="10.5" rx="1"/><rect ${S} x="15.5" y="9" width="3" height="8" rx="1"/>`,
    code: `<rect ${S} x="2.8" y="4.5" width="18.4" height="13" rx="2.2"/><path ${S} d="m7 9 2.5 2-2.5 2m4.5 0h4.5M8 21h8"/>`,
    mic: `<rect ${S} x="9" y="3" width="6" height="11" rx="3"/><path ${S} d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>`,
    gear: `<circle ${S} cx="12" cy="12" r="3"/><path ${S} d="M12 2.8v2.4m0 13.6v2.4M2.8 12h2.4m13.6 0h2.4M5.5 5.5l1.7 1.7m9.6 9.6 1.7 1.7m0-13-1.7 1.7m-9.6 9.6-1.7 1.7"/>`,
    reset: `<path ${S} d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path ${S} d="M4.5 4.5v4h4"/>`,
    box: `<path ${S} d="M3.5 8 12 4l8.5 4v8.5L12 20.5 3.5 16.5z"/><path ${S} d="M3.5 8 12 12l8.5-4M12 12v8.5"/>`,
  };
  const sprite = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('')}</svg>`;
  document.body.insertAdjacentHTML('afterbegin', sprite);
  /** Markup for one icon (static names only). */
  window.TamaIcon = (name) => `<svg class="i" aria-hidden="true"><use href="#i-${ICONS[name] ? name : 'note'}"/></svg>`;
  /** Fill every `.ico[data-i]` placeholder under root once (static icon names from the page's own markup). */
  window.TamaIcons = { fill(root = document) { for (const el of root.querySelectorAll('.ico[data-i]:not([data-filled])')) { el.insertAdjacentHTML('afterbegin', window.TamaIcon(el.dataset.i)); el.dataset.filled = '1'; } } };
})();
