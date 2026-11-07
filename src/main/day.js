// @ts-check
// Local calendar days (YYYY-MM-DD), shared by services that keep daily counters. Pure. (Was in services/pet/bond.js;
// moved so other modules don't deep-import the pet's internals, QC-1.)

/** Local calendar day (YYYY-MM-DD) for a timestamp. @param {number} t */
function dayOf(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** @param {string} day */
function prevDay(day) {
  const [y, m, d] = day.split('-').map(Number);
  return dayOf(new Date(y, m - 1, d - 1, 12).getTime());
}

module.exports = { dayOf, prevDay };
