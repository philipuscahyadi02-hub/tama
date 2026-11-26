/* Music widget icon set (MUS-2): one consistent 24x24 line-icon family drawn for Tama, colored by the theme
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
    lyrics: `<path ${S} d="M4.5 6.5h15M4.5 11.5h10M4.5 16.5h6.5"/><path ${S} d="M18 13v5.2"/><circle ${F} cx="16.6" cy="18.6" r="1.8"/>`,
  };
  const sprite = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('')}</svg>`;
  document.body.insertAdjacentHTML('afterbegin', sprite);
  /** Markup for one icon (static names only). */
  window.TamaIcon = (name) => `<svg class="i" aria-hidden="true"><use href="#i-${ICONS[name] ? name : 'note'}"/></svg>`;
})();
