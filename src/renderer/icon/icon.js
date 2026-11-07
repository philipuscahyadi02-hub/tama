/* App icon renderer (D-047): a dumb view. Draws the active Tama's face, then tells the core it can be captured. */
(async function () {
  const face = document.querySelector('#face');
  const ch = await window.tama.getCharacter().catch(() => null);
  if (ch && ch.stage === 'egg') { face.classList.add('egg'); window.TamaShared.renderEgg(face, face.querySelector('svg')); }
  else if (ch) {
    const spec = window.TamaShared.renderRig(face, face.querySelector('svg'), ch.spec, 'icon-');
    for (const [k, v] of Object.entries(window.TamaShared.theme.chatVars(spec))) document.documentElement.style.setProperty(k, v);
  }
  // Let fonts/SVG settle for two frames, then ask to be captured.
  requestAnimationFrame(() => requestAnimationFrame(() => window.tama.iconReady()));
}());
