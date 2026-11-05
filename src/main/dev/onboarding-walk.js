// @ts-check
// Dev-only scripted walkthrough of the onboarding window (TAMA_ONBOARD_WALK=<dir>). Clicks through
// every step like a user, saves a screenshot per step, hatches, then screenshots the pet. Quits after.
const fs = require('fs');
const path = require('path');

/**
 * @param {{ openOnboarding: (mode: string) => import('electron').BrowserWindow, petWin: import('electron').BrowserWindow,
 *   outDir: string, prompt: string, quit: () => void, log: (m: string) => void }} deps
 */
function runOnboardingWalk({ openOnboarding, petWin, outDir, prompt, quit, log }) {
  const win = openOnboarding('hatch');
  const js = (/** @type {string} */ code) => win.webContents.executeJavaScript(code);
  const wait = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));
  /** @param {import('electron').BrowserWindow} w @param {string} name */
  const shot = async (w, name) => {
    const img = await w.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, `${name}.png`), img.toPNG());
    log(`walk: saved ${name}.png`);
  };
  /** Wait until the onboarding UI is no longer busy (AI calls can take ~30 s). */
  const idle = async () => { for (let i = 0; i < 120; i++) { if (!(await js('st.busy'))) return; await wait(500); } };

  win.webContents.once('did-finish-load', async () => {
    try {
      await wait(800); await shot(win, '1-gender');
      await js(`document.querySelector('.card[data-g="boy"]').click()`);
      await wait(400);
      await js(`(() => { const t = document.querySelector('#prompt'); t.value = ${JSON.stringify(prompt)}; t.dispatchEvent(new Event('input')); })()`);
      await shot(win, '2-describe');
      await js(`document.querySelector('#next').click()`);
      await wait(300); await shot(win, '2b-loading');
      await idle(); await wait(500); await shot(win, '3-pick');
      await js(`(() => { const r = document.querySelector('#refine'); r.value = 'make the hair silver and add a scarf'; document.querySelector('#doRefine').click(); })()`);
      await wait(300); await idle(); await wait(500); await shot(win, '3b-refined');
      await js(`document.querySelector('#next').click()`);
      await wait(600); await shot(win, '4-personalize');
      await js(`document.querySelector('#next').click()`);
      await wait(400);
      await js(`(() => { const v = document.querySelector('#vp'); v.value = 'soft, sleepy, a bit raspy'; v.dispatchEvent(new Event('input')); document.querySelector('#design').click(); })()`);
      await wait(300); await idle(); await wait(400); await shot(win, '5-voice');
      await js(`document.querySelector('#next').click()`);
      await wait(600); await shot(win, '6-confirm');
      const name = await js('st.spec.name');
      await js(`document.querySelector('#go').click()`);
      await wait(3500); await shot(petWin, '7-pet-hatched');
      log(`walk: done, hatched "${name}"`);
    } catch (e) {
      log(`walk: FAILED ${/** @type {Error} */ (e).message}`);
    }
    setTimeout(quit, 500);
  });
}

module.exports = { runOnboardingWalk };
