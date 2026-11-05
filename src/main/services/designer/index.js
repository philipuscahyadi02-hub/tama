// @ts-check
// Designer service (ONB-3..6): description → 3 CharacterSpec variants, refine by chat, voice prompt →
// voice settings. Uses an injected model call (askJson) and always falls back to the keyword designer.
// Every result passes normalizeSpec, whatever the source (ART-2).
const { TOPICS } = require('../../bus-topics');
const specMod = require('../../../shared/spec');
const P = require('./prompt');
const fallback = require('./fallback');

/**
 * @param {{
 *   bus: import('../../bus').BusInstance,
 *   askJson?: ((req: { system: string, prompt: string, schema: object }) => Promise<any>) | null,
 *   log?: (msg: string) => void,
 * }} deps
 */
function createDesigner({ bus, askJson = null, log = () => {} }) {
  /**
   * Try the model; on any failure use the fallback. Returns { variants, source, warning? }.
   * @param {string} prompt @param {object} schema @param {() => any[]} offline
   */
  async function viaModel(prompt, schema, offline) {
    if (askJson) {
      try {
        const out = await askJson({ system: P.SYSTEM, prompt, schema });
        const list = Array.isArray(out && out.variants) ? out.variants : [];
        if (list.length) return { variants: list, source: 'ai' };
        throw new Error('no variants in reply');
      } catch (e) {
        log(`designer: model failed, using keyword designer (${/** @type {Error} */ (e).message})`);
        return { variants: offline(), source: 'offline', warning: 'The AI designer was unavailable, so these were made from keywords.' };
      }
    }
    return { variants: offline(), source: 'offline' };
  }

  /** @param {{ gender: string, prompt: string, name?: string }} req */
  async function generate({ gender, prompt, name }) {
    const r = await viaModel(P.variantsPrompt({ gender, prompt, name }), P.VARIANTS_SCHEMA,
      () => fallback.designFromText({ gender, prompt, name }));
    const variants = r.variants.slice(0, 3).map((v) => specMod.normalizeSpec({
      ...v, gender, designPrompt: prompt, ...(name ? { name } : {}),
    }));
    return { ...r, variants };
  }

  /** @param {{ spec: any, instruction: string }} req */
  async function refine({ spec, instruction }) {
    const base = specMod.normalizeSpec(spec);
    const { paletteOverrides: _drop, ...forModel } = base;
    const r = await viaModel(P.refinePrompt({ spec: forModel, instruction }), P.VARIANTS_SCHEMA,
      () => fallback.refineFromText({ spec: base, instruction }));
    const variants = r.variants.slice(0, 3).map((v) => specMod.normalizeSpec({
      ...v, gender: base.gender, designPrompt: base.designPrompt, voice: base.voice,
    }));
    return { ...r, variants };
  }

  /** @param {{ voicePrompt: string, gender: string, personality?: object }} req */
  async function voice(req) {
    let out;
    let source = 'offline';
    if (askJson) {
      try { out = await askJson({ system: P.SYSTEM, prompt: P.voicePrompt(req), schema: P.VOICE_SCHEMA }); source = 'ai'; } catch (e) {
        log(`designer: voice model failed (${/** @type {Error} */ (e).message})`);
      }
    }
    if (!out) out = fallback.voiceFromText(req);
    // Normalize through the spec gate so ranges/enums are guaranteed.
    const s = specMod.normalizeSpec({ gender: req.gender, voice: { ...out, prompt: req.voicePrompt }, speech: out.speech || undefined });
    return { voice: s.voice, speech: out.speech ? s.speech : null, source };
  }

  function start() {
    const offs = [
      bus.handle(TOPICS.DESIGNER_GENERATE, generate),
      bus.handle(TOPICS.DESIGNER_REFINE, refine),
      bus.handle(TOPICS.DESIGNER_VOICE, voice),
    ];
    return () => { for (const off of offs) off(); };
  }

  return { start, generate, refine, voice };
}

module.exports = { createDesigner };
