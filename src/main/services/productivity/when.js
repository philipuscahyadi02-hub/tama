// @ts-check
// Parse "when" phrases for /remind (PROD-1). Pure: takes `now`, returns { at, text } or null.
// Supports: "in 10m …", "in 2 hours …", "at 15:30 …", "3pm …", "3:15pm …", "tomorrow 9am …", "tomorrow at 9 …".

const UNITS = { s: 1000, sec: 1000, secs: 1000, second: 1000, seconds: 1000, m: 60000, min: 60000, mins: 60000, minute: 60000, minutes: 60000, h: 3600000, hr: 3600000, hrs: 3600000, hour: 3600000, hours: 3600000 };

/**
 * @param {string} input @param {number} now
 * @returns {{ at: number, text: string } | null}
 */
function parseWhen(input, now) {
  let s = String(input || '').trim();
  if (!s) return null;

  // "in 10m buy milk" / "in 2 hours stretch"
  const rel = /^in\s+(\d+(?:\.\d+)?)\s*([a-z]+)\b\s*(.*)$/i.exec(s);
  if (rel) {
    const unit = UNITS[/** @type {keyof typeof UNITS} */ (rel[2].toLowerCase())];
    if (!unit) return null;
    const ms = Number(rel[1]) * unit;
    if (!(ms > 0) || ms > 31 * 24 * 3600000) return null;
    return { at: now + ms, text: clean(rel[3]) };
  }

  let dayOffset = 0;
  const tm = /^tomorrow\b\s*(.*)$/i.exec(s);
  if (tm) { dayOffset = 1; s = tm[1]; }

  // "at 15:30 …", "15:30 …", "3pm …", "3:15 pm …", "at 9 …"
  const abs = /^(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b\s*(.*)$/i.exec(s);
  if (!abs) return null;
  let hour = Number(abs[1]);
  const minute = abs[2] ? Number(abs[2]) : 0;
  const ampm = abs[3] ? abs[3].toLowerCase() : null;
  // A bare number without "at", am/pm or a colon is too ambiguous ("2 cats") — not a time.
  if (!ampm && !abs[2] && !/^at\s/i.test(s) && !tm) return null;
  if (minute > 59 || hour > 23 || (ampm && (hour < 1 || hour > 12))) return null;
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;

  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  // Already passed today → the same time tomorrow.
  if (!dayOffset && d.getTime() <= now) d.setDate(d.getDate() + 1);
  return { at: d.getTime(), text: clean(abs[4]) };
}

/** Strip a leading "to"/"-"/":" ("in 10m to call mom"). @param {string} t */
const clean = (t) => String(t || '').replace(/^(to\s+|[-:,]\s*)/i, '').trim();

/** "in 5 min", "at 15:30", "tomorrow 09:00" for messages. @param {number} at @param {number} now */
function describe(at, now) {
  const mins = Math.round((at - now) / 60000);
  if (mins < 60) return `in ${Math.max(1, mins)} min`;
  const d = new Date(at);
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return new Date(now).toDateString() === d.toDateString() ? `at ${hhmm}` : `tomorrow ${hhmm}`;
}

module.exports = { parseWhen, describe };
