// Resolve a human period to a { since, until, label } date window (YYYY-MM-DD).
// Accepts a quarter ("2025-Q4"), a month ("2025-10"), or an explicit range.
// It matches the period vocabulary the "Month in Core" / quarterly contributor posts use.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n) => String(n).padStart(2, '0');
// Last calendar day of a 1-based month (day 0 of the next month).
const lastDay = (year, month1) => new Date(Date.UTC(year, month1, 0)).getUTCDate();

export function quarterRange(token) {
  const m = /^(\d{4})[-\s]?q([1-4])$/i.exec(String(token).trim());
  if (!m) throw new Error(`invalid quarter: ${token} (use YYYY-Qn, e.g. 2025-Q4)`);
  const year = Number(m[1]);
  const q = Number(m[2]);
  const startMonth = (q - 1) * 3 + 1; // 1, 4, 7, 10
  const endMonth = startMonth + 2;    // 3, 6, 9, 12
  return {
    since: `${year}-${pad(startMonth)}-01`,
    until: `${year}-${pad(endMonth)}-${pad(lastDay(year, endMonth))}`,
    label: `Q${q} ${year}`,
  };
}

export function monthRange(token) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(token).trim());
  if (!m) throw new Error(`invalid month: ${token} (use YYYY-MM, e.g. 2025-10)`);
  const year = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) throw new Error(`invalid month: ${token} (month out of range)`);
  return {
    since: `${year}-${pad(mo)}-01`,
    until: `${year}-${pad(mo)}-${pad(lastDay(year, mo))}`,
    label: `${MONTHS[mo - 1]} ${year}`,
  };
}

export function resolveWindow({ quarter, month, since, until } = {}) {
  if (quarter) return quarterRange(quarter);
  if (month) return monthRange(month);
  if (since && until) return { since, until, label: `${since} to ${until}` };
  throw new Error('provide --quarter YYYY-Qn, --month YYYY-MM, or --since with --until');
}
