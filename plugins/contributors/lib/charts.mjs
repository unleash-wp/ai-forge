// Inline SVG charts, no dependency. Pure string builders so the same chart works
// on the CLI (write to a file), in MCP output, and in the browser.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Bar colour by where the credit comes from.
const color = (src) => (src === 'core' ? '#3858e9' : src === 'gutenberg' ? '#1a9d6b' : '#7c3aed');

// Horizontal bar chart of rows of { name, value, source? }. Shared by the
// contributor leaderboard and the company breakdown.
function barsSvg(rows, { title = '' } = {}) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0) || 1;
  const rowH = 22, padL = 150, padR = 56, padT = title ? 44 : 12, padB = 12, barMax = 360;
  const width = padL + barMax + padR;
  const height = padT + rows.length * rowH + padB;

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="-apple-system, system-ui, sans-serif">`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
  ];
  if (title) parts.push(`<text x="${padL}" y="26" font-size="15" font-weight="700" fill="#1e1e1e">${esc(title)}</text>`);
  rows.forEach((r, i) => {
    const y = padT + i * rowH;
    const w = Math.max(2, Math.round((r.value / max) * barMax));
    parts.push(`<text x="${padL - 8}" y="${y + 15}" font-size="12" text-anchor="end" fill="#1e1e1e">${esc(r.name)}</text>`);
    parts.push(`<rect x="${padL}" y="${y + 4}" width="${w}" height="${rowH - 8}" rx="3" fill="${color(r.source)}"/>`);
    parts.push(`<text x="${padL + w + 6}" y="${y + 15}" font-size="12" fill="#555555">${r.value}</text>`);
  });
  parts.push('</svg>');
  return parts.join('\n');
}

// Most-credited contributors (coloured by Core / Gutenberg / both).
export function leaderboardSvg(byContributor, { top = 20, title = '' } = {}) {
  const rows = byContributor.slice(0, top).map((c) => ({ name: c.name, value: c.props, source: c.source }));
  return barsSvg(rows, { title });
}

// Companies ranked by credited contributions.
export function companySvg(byCompany, { top = 15, title = '' } = {}) {
  const rows = byCompany.slice(0, top).map((c) => ({ name: c.company, value: c.contributions, source: 'company' }));
  return barsSvg(rows, { title });
}

// Brand navy ramp + neutrals for the shareable donut (matches the on-screen donut).
const RAMP = ['#203159', '#2a3f6f', '#3c4e7d', '#4a5c8c', '#5d6f9f', '#7385b0', '#8f9dc4', '#aab6d6'];
const OTHERS = '#c3cadb', INK = '#1e1e1e', MUTE = '#5b6472';

// Polar point, top-start clockwise (0 = 12 o'clock), fraction of the full circle.
function pt(cx, cy, rad, frac) {
  const a = (frac * 360 - 90) * Math.PI / 180;
  return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
}
// One donut segment (outer arc CW, inner arc CCW) between two fractions.
function segPath(cx, cy, R, r, f0, f1) {
  const large = (f1 - f0) > 0.5 ? 1 : 0;
  const [xa, ya] = pt(cx, cy, R, f0), [xb, yb] = pt(cx, cy, R, f1);
  const [xc, yc] = pt(cx, cy, r, f1), [xd, yd] = pt(cx, cy, r, f0);
  const n = (v) => v.toFixed(2);
  return `M${n(xa)} ${n(ya)} A${R} ${R} 0 ${large} 1 ${n(xb)} ${n(yb)} L${n(xc)} ${n(yc)} A${r} ${r} 0 ${large} 0 ${n(xd)} ${n(yd)} Z`;
}
const clip = (s, max = 26) => (s.length > max ? s.slice(0, max - 1) + '…' : s);

// A self-contained, brand-navy donut with a ranked legend - an image you can drop
// straight into a "Month in Core" style post. `slices` are the on-screen slices
// [{ name, value, others? }]; `total`/`unit` fill the center.
export function donutSvg(slices, { title = '', total = '', unit = '' } = {}) {
  const rows = slices.filter((r) => r.value > 0);
  const sum = rows.reduce((s, r) => s + r.value, 0) || 1;
  const cx = 132, cy = 156, R = 96, r = 64;
  const legendX = 272, rowH = 26, legendTop = 78;
  const width = 640;
  const height = Math.max(312, legendTop + rows.length * rowH + 40);
  const colorOf = (row, i) => (row.others ? OTHERS : RAMP[i % RAMP.length]);

  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="-apple-system, system-ui, sans-serif">`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
  ];
  if (title) out.push(`<text x="32" y="42" font-size="18" font-weight="700" fill="${INK}">${esc(title)}</text>`);

  if (rows.length === 1) {
    // A single 100% slice: an arc from a point back to itself is degenerate, so
    // draw the full ring as a thick stroked circle instead.
    out.push(`<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${colorOf(rows[0], 0)}" stroke-width="${R - r}"/>`);
  } else {
    let acc = 0;
    rows.forEach((row, i) => {
      const f0 = acc / sum; acc += row.value; const f1 = acc / sum;
      out.push(`<path d="${segPath(cx, cy, R, r, f0, f1)}" fill="${colorOf(row, i)}"/>`);
    });
  }
  out.push(`<text x="${cx}" y="${cy - 1}" font-size="30" font-weight="800" text-anchor="middle" fill="${INK}">${esc(String(total))}</text>`);
  if (unit) out.push(`<text x="${cx}" y="${cy + 19}" font-size="12" text-anchor="middle" fill="${MUTE}">${esc(unit)}</text>`);

  rows.forEach((row, i) => {
    const y = legendTop + i * rowH;
    const pct = Math.round((row.value / sum) * 100);
    out.push(`<rect x="${legendX}" y="${y}" width="12" height="12" rx="3" fill="${colorOf(row, i)}"/>`);
    out.push(`<text x="${legendX + 20}" y="${y + 11}" font-size="13" fill="${INK}">${esc(clip(row.name))}</text>`);
    out.push(`<text x="${width - 32}" y="${y + 11}" font-size="13" text-anchor="end" fill="${MUTE}">${row.value} · ${pct}%</text>`);
  });

  out.push(`<text x="32" y="${height - 16}" font-size="11" fill="#9aa3b2">UnleashWP AI Forge</text>`);
  out.push('</svg>');
  return out.join('\n');
}
