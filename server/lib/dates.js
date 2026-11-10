'use strict';

/**
 * Normalises a date of birth typed in any common format into "DDMMYYYY".
 * Accepts: 05-08-2012, 05/08/2012, 05.08.2012, 5-8-2012, 05082012, 2012-08-05.
 * Returns null for anything that is not a real calendar date.
 */
function normalizeDob(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (!s || s.length > 12) return null;

  let d;
  let m;
  let y;
  let match;
  if ((match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s))) {
    [, y, m, d] = match;
  } else if ((match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s))) {
    [, d, m, y] = match;
  } else if ((match = /^(\d{2})(\d{2})(\d{4})$/.exec(s))) {
    [, d, m, y] = match;
  } else {
    return null;
  }
  const dn = Number(d);
  const mn = Number(m);
  const yn = Number(y);
  if (yn < 1900 || yn > 2100 || mn < 1 || mn > 12 || dn < 1) return null;
  const daysInMonth = new Date(Date.UTC(yn, mn, 0)).getUTCDate();
  if (dn > daysInMonth) return null;
  return `${String(dn).padStart(2, '0')}${String(mn).padStart(2, '0')}${yn}`;
}

/** "05082012" -> "05-08-2012" */
function prettyDob(input) {
  const n = normalizeDob(input);
  return n ? `${n.slice(0, 2)}-${n.slice(2, 4)}-${n.slice(4)}` : '';
}

module.exports = { normalizeDob, prettyDob };
