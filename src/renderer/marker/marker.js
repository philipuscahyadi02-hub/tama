/* "Out for a walk" marker (SUM-5, D-035): a dumb view. Shows the Tama's face; a click asks the core to summon her. */
const K = window.tama;
const tab = document.querySelector('#tab');
const face = document.querySelector('#face');

async function refresh() {
  const ch = await K.getCharacter().catch(() => null);
  if (!ch) return;
  let name = 'Your egg';
  let them = 'it';
  if (ch.stage === 'egg') {
    window.TamaShared.renderEgg(face, face.querySelector('svg'));
  } else {
    const spec = window.TamaShared.renderRig(face, face.querySelector('svg'), ch.spec, 'marker-');
    for (const [k, v] of Object.entries(window.TamaShared.theme.chatVars(spec))) document.documentElement.style.setProperty(k, v);
    name = spec.name;
    them = spec.gender === 'boy' ? 'him' : spec.gender === 'girl' ? 'her' : 'them';
  }
  tab.title = `${name} is out for a walk — click to call ${them} back`;
}

tab.addEventListener('click', () => K.summon());
// The window is hidden and shown again, not reloaded: pick up a restyle whenever it becomes visible.
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
refresh();
