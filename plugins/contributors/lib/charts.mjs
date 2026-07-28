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
