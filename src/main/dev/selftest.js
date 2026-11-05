// @ts-check
// Dev-only live check for the summon fix (TAMA_SELFTEST=1). Reproduces kero-pet's failure modes in the
// real app: pet pushed off-screen, then hidden. Logs PASS/FAIL lines and quits.
const geo = require('../platform/summon/geometry');

/**
 * @param {{
 *   pet: import('../platform/windows/pet-window').PetWindow,
 *   summoner: ReturnType<typeof import('../platform/summon').createSummoner>,
 *   workAreas: () => import('../platform/summon/geometry').Rect[],
 *   quit: () => void,
 * }} deps
 */
function runSelfTest({ pet, summoner, workAreas, quit }) {
  const results = /** @type {string[]} */ ([]);
  /** @param {string} name @param {boolean} ok @param {any} [detail] */
  const check = (name, ok, detail) => {
    const line = `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` ${JSON.stringify(detail)}` : ''}`;
    results.push(line);
    console.log(`[selftest] ${line}`);
  };
  const visible = () => geo.isVisibleEnough(pet.bounds(), workAreas(), 1);

  setTimeout(() => {
    check('starts fully on screen', visible(), pet.bounds());

    // 1) Bypass the drag clamp and throw the window far off-screen (old drag bug / unplugged monitor).
    pet.win.setBounds({ x: -6000, y: 4000, ...pet.SIZE });
    summoner.check('selftest');
    check('watchdog pulls an off-screen pet back', visible(), pet.bounds());

    // 2) Drag clamp: a huge drag can't leave the screen.
    pet.dragBy(99999, 99999);
    check('drag is clamped to the screen', visible(), pet.bounds());

    // 3) Hidden via "Show / Hide": watchdog must respect it, summon must override it.
    pet.hide();
    summoner.check('selftest');
    check('watchdog leaves a user-hidden pet hidden', !pet.win.isVisible());
    summoner.summon('selftest');
    check('summon shows a hidden pet', pet.win.isVisible());
    check('summon puts it on screen', visible(), pet.bounds());
    check('summon keeps always-on-top', pet.win.isAlwaysOnTop());

    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`[selftest] done: ${results.length - failed}/${results.length} passed`);
    setTimeout(quit, 2500); // leave time for TAMA_SHOT screenshots
  }, 3000);
}

module.exports = { runSelfTest };
