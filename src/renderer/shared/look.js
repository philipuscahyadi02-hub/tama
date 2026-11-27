/* The Look (D-078), page side: one place that colors a window from her CharacterSpec in the chosen mode (light, dark,
   or auto = follow Windows) and material (solid or glass). Glass needs the window's acrylic (platform/look.js) and is
   skipped when Windows' transparency effects are off, the same rule the main process uses. Plain script (no modules):
   load after shared/palette.js and shared/theme.js, then call TamaLook.start(). */
(function () {
  const K = window.tama;
  const mqDark = window.matchMedia('(prefers-color-scheme: dark)');
  const mqLessGlass = window.matchMedia('(prefers-reduced-transparency: reduce)');
  let spec = null;
  let prefs = null;
  let hooks = [];
  let state = { material: 'solid', mode: 'light' };

  function resolve() {
    const p = prefs || {};
    const material = p.lookMaterial === 'glass' && !mqLessGlass.matches ? 'glass' : 'solid';
    const mode = p.lookMode === 'dark' ? 'dark' : p.lookMode === 'auto' ? (mqDark.matches ? 'dark' : 'light') : 'light';
    return { material, mode };
  }

  function apply() {
    state = resolve();
    const root = document.documentElement;
    root.dataset.material = state.material;
    root.dataset.mode = state.mode;
    root.style.colorScheme = state.mode;
    const vars = window.TamaShared.theme.lookVars(spec || {}, { mode: state.mode, glass: state.material === 'glass' });
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    // Header pattern from her design (assets/look/<tile>.svg, tinted by look.css). Pages sit at src/renderer/<page>/.
    root.style.setProperty('--tama-motif', `url("../../../assets/look/${window.TamaShared.theme.motifOf(spec || {})}.svg")`);
    for (const f of hooks) { try { f(state, spec); } catch (e) { console.error('[look]', e); } }
  }

  /** @param {any} ch a character payload ({ spec, stage }); eggs keep the default colors */
  function setCharacter(ch) { spec = ch && ch.stage !== 'egg' && ch.spec ? ch.spec : null; apply(); }

  window.TamaLook = {
    /** Color this window and keep it in sync. onChange(state, spec) runs after every repaint. */
    async start({ onChange } = {}) {
      if (onChange) hooks.push(onChange);
      mqDark.addEventListener('change', apply);
      mqLessGlass.addEventListener('change', apply);
      apply();
      if (K && K.ui && K.ui.onPrefs) K.ui.onPrefs((p) => { prefs = p; apply(); });
      if (K && K.onCharacter) K.onCharacter(setCharacter);
      const [ch, p] = await Promise.all([
        K && K.getCharacter ? K.getCharacter().catch(() => null) : null,
        K && K.ui && K.ui.prefs ? K.ui.prefs().catch(() => null) : null,
      ]);
      prefs = p;
      setCharacter(ch);
    },
    /** Use prefs that arrived another way (e.g. a window that isn't sent ui.prefs). */
    setPrefs(p) { prefs = p; apply(); },
    current: () => ({ ...state }),
  };
})();
