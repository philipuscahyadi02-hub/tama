/* Onboarding / hatching (ONB-2..6) + restyle / rebirth (PORT-4).
   ?mode=hatch | restyle | rebirth. All AI work happens in the main-process designer; this file is UI only. */
const T = window.tama;
const S = window.TamaShared;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const mode = new URLSearchParams(location.search).get('mode') || 'hatch';
const FLOWS = {
  hatch: ['gender', 'describe', 'pick', 'personalize', 'voice', 'confirm'],
  rebirth: ['gender', 'describe', 'pick', 'personalize', 'voice', 'confirm'],
  restyle: ['pick', 'personalize', 'voice', 'confirm'],
};
const LABELS = { gender: 'Gender', describe: 'Describe', pick: 'Choose', personalize: 'Personalize', voice: 'Voice', confirm: 'Hatch' };
const flow = FLOWS[mode] || FLOWS.hatch;

const st = {
  i: 0, gender: null, prompt: '', name: '', variants: [], sel: 0, spec: null, warning: null,
  voicePrompt: '', voiceSource: null, keepBond: true, busy: false, busyText: '',
};
let rigN = 0;
let moodTimer = null;

// ---------------- helpers ----------------
function rig(spec, mood = 'normal') {
  const wrap = document.createElement('div');
  wrap.className = `tama-rig mood-${mood}`;
  wrap.innerHTML = '<svg class="rig-svg" viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg"></svg>';
  S.renderRig(wrap, wrap.firstChild, spec, `ob${rigN++}-`);
  return wrap;
}
function egg() {
  const wrap = document.createElement('div');
  wrap.className = 'tama-rig egg';
  wrap.innerHTML = '<svg class="rig-svg" viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg"></svg>';
  S.renderEgg(wrap, wrap.firstChild);
  return wrap;
}
function cycleMoods(el) {
  const moods = ['normal', 'happy', 'sparkle', 'smug', 'pat', 'normal'];
  let k = 0;
  clearInterval(moodTimer);
  moodTimer = setInterval(() => {
    const r = el.querySelector('.tama-rig');
    if (!r) return clearInterval(moodTimer);
    r.className = r.className.replace(/\bmood-\w+/, `mood-${moods[k++ % moods.length]}`);
  }, 1600);
}
const step = () => flow[st.i];
const setSpec = (spec) => { st.spec = S.spec.normalizeSpec(spec); };

async function busy(text, fn) {
  st.busy = true; st.busyText = text; render();
  try { return await fn(); } catch (e) { st.warning = `Something went wrong: ${e.message || e}`; return null; } finally { st.busy = false; render(); }
}

// ---------------- steps ----------------
const STEPS = {
  gender: {
    html: () => `<h1>Who's in the egg?</h1><p class="sub">This sets pronouns and starting styles. Any look works for anyone.</p>
      <div class="cards">${[['girl', '🎀', 'Girl', 'she / her'], ['boy', '🧢', 'Boy', 'he / him'], ['nonbinary', '🌈', 'Non-binary', 'they / them'], ['surprise', '🎲', 'Surprise me', 'random pick']]
        .map(([g, e, t, s]) => `<div class="card ${st.gender === g ? 'sel' : ''}" data-g="${g}"><div class="big">${e}</div><b>${t}</b><small>${s}</small></div>`).join('')}</div>
      ${mode === 'hatch' ? '<p class="sub" style="margin-top:22px">Already have a Tama from another PC? <button id="bring" class="ghost">📦 Bring my Tama</button></p>' : ''}`,
    bind: () => {
      document.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => {
        st.gender = c.dataset.g === 'surprise' ? ['girl', 'boy', 'nonbinary'][Math.floor(Math.random() * 3)] : c.dataset.g;
        next();
      }));
      const bring = $('#bring');
      if (bring) bring.addEventListener('click', () => { T.openRoster(true); T.closeSelf(); });
    },
    ok: () => !!st.gender,
  },

  describe: {
    html: () => `<h1>Describe your companion</h1><p class="sub">Look, vibe, favorite things. Your Tama is designed from your words.</p>
      <textarea id="prompt" rows="4" maxlength="600" placeholder="e.g. a sleepy cat boy in a hoodie who loves lo-fi music and coffee">${esc(st.prompt)}</textarea>
      <div class="chips">${['frog girl in a raincoat, bubbly', 'sleepy cat boy with headphones', 'elegant bunny with a big ribbon', 'tsundere fox with a scarf', 'shy bear in overalls who loves books', 'chaotic gremlin with spiky hair']
        .map((c) => `<span class="chip">${c}</span>`).join('')}</div>
      <label class="label">Name <small style="font-weight:400;color:var(--muted)">(optional; leave empty and one will be suggested)</small></label>
      <input id="name" type="text" maxlength="24" value="${esc(st.name)}" placeholder="e.g. Mochi" />`,
    bind: () => {
      $('#prompt').addEventListener('input', (e) => { st.prompt = e.target.value; updateNav(); });
      $('#name').addEventListener('input', (e) => { st.name = e.target.value; });
      document.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => { st.prompt = c.textContent; $('#prompt').value = st.prompt; updateNav(); }));
      $('#prompt').focus();
    },
    ok: () => st.prompt.trim().length >= 3,
    async leave() {
      const r = await busy('Hatching ideas', () => T.designerGenerate({ gender: st.gender, prompt: st.prompt.trim(), name: st.name.trim() || undefined }));
      if (!r) return false;
      st.variants = r.variants; st.sel = 0; st.warning = r.warning || null;
      return true;
    },
  },

  pick: {
    html: () => `<h1>${mode === 'restyle' ? 'Change your look' : 'Pick your favorite'}</h1>
      <p class="sub">${mode === 'restyle' ? 'Describe a change, or go straight to fine-tuning.' : 'Click one. Not quite right? Describe a change or reroll.'}</p>
      ${st.warning ? `<div class="warn">${esc(st.warning)}</div>` : ''}
      <div class="variants" id="variants"></div>
      <label class="label">Change something</label>
      <div class="row"><input id="refine" type="text" maxlength="300" placeholder="e.g. silver hair, add glasses, make the hoodie pink" />
        <button id="doRefine" class="ghost">Apply ✨</button>${mode === 'restyle' ? '' : '<button id="reroll" class="ghost">🎲 Reroll</button>'}</div>`,
    bind: () => {
      const box = $('#variants');
      st.variants.forEach((v, k) => {
        const card = document.createElement('div');
        card.className = `variant ${k === st.sel ? 'sel' : ''}`;
        card.appendChild(rig(v, k === st.sel ? 'happy' : 'normal'));
        card.insertAdjacentHTML('beforeend', `<b>${esc(v.name)}</b><p>${esc(v.motif || v.speech.style)}</p>`);
        card.addEventListener('click', () => { st.sel = k; render(); });
        box.appendChild(card);
      });
      if (st.variants.length === 1) box.style.gridTemplateColumns = '220px';
      const refine = async () => {
        const instruction = $('#refine').value.trim();
        if (!instruction) return;
        const r = await busy('Redesigning', () => T.designerRefine({ spec: st.variants[st.sel], instruction }));
        if (r) { st.variants = r.variants; st.sel = 0; st.warning = r.warning || null; render(); }
      };
      $('#doRefine').addEventListener('click', refine);
      $('#refine').addEventListener('keydown', (e) => { if (e.key === 'Enter') refine(); });
      const reroll = $('#reroll');
      if (reroll) reroll.addEventListener('click', async () => { if (await STEPS.describe.leave()) render(); });
    },
    ok: () => st.variants.length > 0,
    leave() {
      const chosen = st.variants[st.sel];
      // Keep voice/speech already tuned (restyle) unless this is a fresh design.
      setSpec(st.spec && mode === 'restyle' ? { ...chosen, voice: st.spec.voice } : chosen);
      return true;
    },
  },

  personalize: {
    html: () => {
      const p = st.spec.personality;
      const sl = (k, lo, hi) => `<div class="slider"><b>${k[0].toUpperCase() + k.slice(1)}</b><input type="range" min="0" max="100" value="${p[k]}" data-k="${k}" /><span>${lo} ↔ ${hi}</span></div>`;
      return `<div class="split"><div class="preview" id="pv"></div><div>
        <h1>Make it yours</h1>
        <label class="label">Name</label><input id="nm" type="text" maxlength="24" value="${esc(st.spec.name)}" />
        <label class="label">Personality</label>
        ${sl('energy', 'sleepy', 'hyper')}${sl('tsundere', 'sweet', 'tsun')}${sl('formality', 'casual', 'polite')}${sl('chaos', 'calm', 'chaotic')}
        <label class="label">Colors</label>
        <div class="colors">${S.palette.BASE_KEYS.map((k) => `<label>${k}<input type="color" data-c="${k}" value="${st.spec.palette[k]}" /></label>`).join('')}</div>
      </div></div>`;
    },
    bind: () => {
      const pv = $('#pv');
      const paint = () => { pv.innerHTML = ''; pv.appendChild(rig(st.spec, 'happy')); pv.insertAdjacentHTML('beforeend', `<div class="say">${esc(st.spec.name)}</div>`); };
      paint(); cycleMoods(pv);
      $('#nm').addEventListener('input', (e) => { st.spec.name = e.target.value; pv.querySelector('.say').textContent = e.target.value; updateNav(); });
      document.querySelectorAll('input[type=range]').forEach((r) => r.addEventListener('input', () => { st.spec.personality[r.dataset.k] = Number(r.value); }));
      document.querySelectorAll('input[type=color]').forEach((c) => c.addEventListener('input', () => {
        st.spec.palette[c.dataset.c] = c.value;
        delete st.spec.paletteOverrides; // custom colors end a preset's pinned shades
        paint();
      }));
    },
    ok: () => !!(st.spec && st.spec.name.trim()),
    leave() { setSpec(st.spec); return true; },
  },

  voice: {
    html: () => `<div class="split"><div class="preview" id="pv"></div><div>
      <h1>Design the voice</h1><p class="sub">Describe how ${esc(st.spec.name)} sounds. This also tunes how they talk in chat.</p>
      <textarea id="vp" rows="3" maxlength="300" placeholder="e.g. soft and sleepy, a little raspy, giggles a lot">${esc(st.voicePrompt || st.spec.voice.prompt)}</textarea>
      <div class="chips">${['bright, bubbly, a little squeaky', 'soft, sleepy, slow', 'calm, low and gentle', 'fast, excited, giggly', 'polite and elegant']
        .map((c) => `<span class="chip">${c}</span>`).join('')}</div>
      <div class="row"><button id="design" class="ghost">Design voice ✨</button><button id="play" class="ghost">▶ Preview</button></div>
      <div class="facts" id="facts"></div></div></div>`,
    bind: () => {
      const pv = $('#pv');
      pv.appendChild(rig(st.spec, 'happy')); pv.insertAdjacentHTML('beforeend', '<div class="say" id="sayLine"></div>');
      const facts = () => {
        const v = st.spec.voice; const sp = st.spec.speech;
        $('#facts').innerHTML = `🎚️ pitch <b>${v.pitch.toFixed(2)}</b> · speed <b>${v.rate.toFixed(2)}</b> · ${esc(v.voiceGender)} voice ${st.voiceSource ? `<small>(${esc(st.voiceSource)})</small>` : ''}<br>
          💬 ${esc(sp.style)}<br>✨ tics: ${esc(sp.tics.join(', ') || '—')} · catchphrases: ${esc(sp.catchphrases.join(' / ') || '—')}`;
      };
      facts();
      $('#vp').addEventListener('input', (e) => { st.voicePrompt = e.target.value; });
      document.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => { st.voicePrompt = c.textContent; $('#vp').value = st.voicePrompt; }));
      $('#design').addEventListener('click', async () => {
        const vp = ($('#vp').value || '').trim();
        if (!vp) return;
        const r = await busy('Tuning the voice', () => T.designerVoice({ voicePrompt: vp, gender: st.spec.gender, personality: st.spec.personality }));
        if (r) { st.voicePrompt = vp; st.voiceSource = r.source === 'ai' ? 'AI' : 'offline'; setSpec({ ...st.spec, voice: r.voice, speech: r.speech || st.spec.speech }); render(); }
      });
      $('#play').addEventListener('click', () => {
        const sp = st.spec.speech;
        const line = `Hi! I'm ${st.spec.name}. ${sp.catchphrases[0] || "Let's do our best today!"} ${sp.tics[0] || ''}`;
        $('#sayLine').textContent = line;
        window.TamaVoice.speak(line.replace(/[~*]/g, ''), st.spec.voice);
      });
    },
    ok: () => true,
  },

  confirm: {
    html: () => {
      const s = st.spec;
      const verb = mode === 'restyle' ? 'Save the new look ✨' : mode === 'rebirth' ? 'Be reborn 🌸' : 'Hatch! 🐣';
      return `<div class="split"><div class="preview" id="pv"></div><div>
        <h1>${esc(s.name)}</h1><p class="sub">${esc(s.motif || s.designPrompt)}</p>
        <div class="facts">🧬 ${esc(s.gender)} · ${esc(s.pronouns.subject)}/${esc(s.pronouns.object)}<br>
          👗 ${esc(s.parts.headwear)} · ${esc(s.parts.outfit)} · ${esc(s.parts.hairBack)} hair · ${esc(s.parts.eyes)} eyes<br>
          💬 ${esc(s.speech.style)}<br>🎙️ ${esc(s.voice.prompt || 'default voice')}</div>
        ${mode === 'rebirth' ? `<label class="check"><input id="kb" type="checkbox" ${st.keepBond ? 'checked' : ''}/> Keep our bond, level and memories</label>` : ''}
        <p class="sub" style="margin-top:14px">${mode === 'restyle' ? 'Stats, bond and memories stay the same.' : mode === 'rebirth' ? 'The old look is replaced.' : 'Your new friend will appear on the desktop.'}</p>
        <button id="go" class="primary">${verb}</button></div></div>`;
    },
    bind: () => {
      const pv = $('#pv'); pv.appendChild(rig(st.spec, 'sparkle')); cycleMoods(pv);
      const kb = $('#kb');
      if (kb) kb.addEventListener('change', () => { st.keepBond = kb.checked; });
      $('#go').addEventListener('click', async () => {
        const r = await busy('Hatching', () => T.characterSave({ spec: st.spec, mode, keepBond: st.keepBond }));
        if (r) T.closeSelf();
      });
    },
    ok: () => false, // the big button finishes
  },
};

// ---------------- frame ----------------
function render() {
  $('#title').textContent = mode === 'restyle' ? 'Restyle your Tama' : mode === 'rebirth' ? 'Rebirth' : 'Hatch your Tama';
  $('#steps').innerHTML = flow.map((s, k) => `<li class="${k === st.i ? 'on' : k < st.i ? 'done' : ''}">${LABELS[s]}</li>`).join('');
  const screen = $('#screen');
  clearInterval(moodTimer);
  if (st.busy) {
    screen.innerHTML = `<div class="loading"><div id="eggBox"></div><h1>${esc(st.busyText)}<span class="dots"></span></h1>
      <p class="sub">The AI designer can take up to half a minute.</p></div>`;
    $('#eggBox').appendChild(egg());
  } else {
    screen.innerHTML = STEPS[step()].html();
    STEPS[step()].bind();
  }
  updateNav();
}
function updateNav() {
  const s = STEPS[step()];
  $('#back').style.visibility = st.i > 0 && !st.busy ? 'visible' : 'hidden';
  $('#next').style.display = step() === 'confirm' ? 'none' : '';
  $('#next').disabled = st.busy || !s.ok();
  $('#hint').textContent = step() === 'voice' ? 'Voice is optional; you can change it later.' : '';
}
async function next() {
  const s = STEPS[step()];
  if (st.busy || !s.ok()) return;
  if (s.leave && !(await s.leave())) return;
  st.i = Math.min(flow.length - 1, st.i + 1);
  render();
}
$('#next').addEventListener('click', next);
$('#back').addEventListener('click', () => { if (!st.busy && st.i > 0) { st.i -= 1; render(); } });
$('#close').addEventListener('click', () => T.closeSelf());

(async function boot() {
  if (mode !== 'hatch') {
    const ch = await T.getCharacter();
    setSpec(ch.spec);
    st.gender = ch.spec.gender;
    st.name = mode === 'rebirth' ? '' : ch.spec.name;
    if (mode === 'restyle') { st.variants = [st.spec]; st.sel = 0; }
  }
  render();
}());
