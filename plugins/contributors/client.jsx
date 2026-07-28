// Contributors — client side of the bundled UnleashWP core plugin. An analytics
// view of who contributed to WordPress Core + Gutenberg in a period: activity
// over time, a donut of the top people, a selectable ranked list (with photo and
// employer), what each person shipped, and which company invested most.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Flex, Heading, HStack, Popover, Portal, SimpleGrid, Spinner, Stack, Skeleton, Text, chakra } from '@chakra-ui/react';
import { PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useCore, fetchJSON } from '../../src/client/core.jsx';
import { TextInput, Select, DateRangePicker } from '../../src/client/ui';
import { CoreIcon, GutenbergIcon } from '../../src/client/wp-icons.jsx';
import { donutSvg } from './lib/charts.mjs';

// UnleashWP brand: navy ramp + yellow accent. Selected slice/row turns yellow.
const NAVY = '#203159';
const YELLOW = '#fcbe00';
const RAMP = ['#203159', '#2a3f6f', '#3c4e7d', '#4a5c8c', '#5d6f9f', '#7385b0', '#8f9dc4', '#aab6d6'];
const OTHERS = '#c3cadb';
const MEDAL = ['#fcbe00', '#b9c2d1', '#cd7f4f']; // gold, silver, bronze for the top three
const AXIS = '#94a1bd';                          // muted grey, readable in light + dark
const pad = (n) => String(n).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

function quarterWindow(year, q) {
  const sm = (q - 1) * 3 + 1;
  const em = sm + 2;
  const last = new Date(Date.UTC(year, em, 0)).getUTCDate();
  return { since: `${year}-${pad(sm)}-01`, until: `${year}-${pad(em)}-${pad(last)}` };
}
function buildPeriods(now) {
  const y = now.getUTCFullYear();
  const curQ = Math.floor(now.getUTCMonth() / 3) + 1;
  const out = [{ value: 'custom', label: 'Custom dates' }]; // custom first, per request
  let qy = y, qq = curQ;
  for (let i = 0; i < 8; i++) {
    out.push({ value: `q-${qy}-${qq}`, label: `Q${qq} ${qy}${qy === y && qq === curQ ? ' (in progress)' : ''}`, ...quarterWindow(qy, qq) });
    qq -= 1; if (qq === 0) { qq = 4; qy -= 1; }
  }
  for (let yr = y; yr >= y - 3; yr -= 1) out.push({ value: `y-${yr}`, label: `${yr} annual report`, since: `${yr}-01-01`, until: `${yr}-12-31` });
  return out;
}

function toSlices(rows, top) {
  const head = rows.slice(0, top);
  const rest = rows.slice(top).reduce((s, r) => s + r.value, 0);
  return rest > 0 ? [...head, { name: 'Others', value: rest, others: true }] : head;
}
const sliceColor = (row, i, selected) => (row.name === selected ? YELLOW : row.others ? OTHERS : RAMP[i % RAMP.length]);
const fmtDay = (d) => { const [y, m, day] = String(d).split('-'); return new Date(Date.UTC(+y, +m - 1, +day)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };

// Match a contributor's employer to a company display name the same way the
// backend groups them ("Open to work" is not an employer; case/punctuation-
// insensitive), so clicking a company can list the people who work there.
const canonCompany = (e) => { if (!e) return null; const c = String(e).replace(/\s+/g, ' ').trim(); return /^open to work$/i.test(c) ? null : c; };
const coKey = (e) => { const c = canonCompany(e); return c ? c.toLowerCase().replace(/[^a-z0-9]+/g, '') : '__unknown__'; };

function Field({ label, children }) {
  return (
    <Box display="flex" flexDir="column" gap="1.5" flex="1 1 10rem" minW="9rem">
      <Text as="span" fontSize="0.7813rem" fontWeight="600" letterSpacing=".04em" textTransform="uppercase" color="ui.muted">{label}</Text>
      {children}
    </Box>
  );
}

function StatCard({ n, label, counted }) {
  return (
    <Box bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="forge" px="5" py="4" boxShadow="sm"
      css={counted ? { boxShadow: 'inset 0 2.5px 0 var(--chakra-colors-yellow), var(--chakra-shadows-sm)' } : undefined}>
      <chakra.b display="block" fontSize="clamp(1.5rem, 1.2rem + 1vw, 2rem)" fontWeight="800" color="ui.heading" lineHeight="1.1" letterSpacing="-.02em" fontVariantNumeric="tabular-nums" whiteSpace="nowrap">{n}</chakra.b>
      <Text display="block" color="ui.muted" fontSize="0.8125rem" mt="1" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">{label}</Text>
    </Box>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <HStack gap="0" bg="ui.sunk" borderRadius="md" p="0.25rem" display="inline-flex" flex="none">
      {options.map((o) => (
        <chakra.button key={o.value} type="button" onClick={() => onChange(o.value)} px="3.5" py="1.5" borderRadius="sm"
          fontSize="0.8125rem" fontWeight={value === o.value ? '700' : '500'} cursor="pointer" whiteSpace="nowrap" display="inline-flex" alignItems="center" gap="1.5"
          bg={value === o.value ? 'ui.surface' : 'transparent'} color={value === o.value ? 'ui.heading' : 'ui.muted'}
          boxShadow={value === o.value ? 'sm' : 'none'} transition="background .12s, color .12s">{o.label}</chakra.button>
      ))}
    </HStack>
  );
}

// Small, themed chart tooltip (recharts' default is oversized and unstyled).
function TipBox({ active, payload, label, kind, dated }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <Box bg="navy" borderRadius="md" boxShadow="lg" px="2.5" py="1.5" css={{ pointerEvents: 'none' }}>
      {dated ? (
        <>
          <Text color="rgba(255,255,255,.7)" fontSize="0.6875rem" lineHeight="1.2">{fmtDay(label)}</Text>
          <Text color="white" fontSize="0.8125rem" fontWeight="700" lineHeight="1.3" fontVariantNumeric="tabular-nums">
            <chakra.span color="yellow">{p.value}</chakra.span> {kind}
          </Text>
        </>
      ) : (
        <Text color="white" fontSize="0.75rem" fontWeight="600" lineHeight="1.2">
          {p.name ?? p.payload?.name}: <chakra.span color="yellow" fontWeight="800">{p.value}</chakra.span> {kind}
        </Text>
      )}
    </Box>
  );
}

// Underlined tab bar for switching Contributors / Companies.
function TabBar({ tabs, value, onChange, right }) {
  return (
    <Flex align="flex-end" gap="1" borderBottomWidth="1px" borderColor="ui.border" mb="6">
      {tabs.map((t) => (
        <chakra.button key={t.value} type="button" onClick={() => onChange(t.value)}
          px="4" py="2.5" fontSize="0.9375rem" fontWeight={value === t.value ? '700' : '500'} cursor="pointer"
          color={value === t.value ? 'ui.heading' : 'ui.muted'} borderBottomWidth="2px" mb="-1px"
          borderColor={value === t.value ? 'navy' : 'transparent'} transition="color .12s, border-color .12s" _hover={{ color: 'ui.heading' }}>
          {t.label}
        </chakra.button>
      ))}
      {right && <Box ml="auto" pb="2">{right}</Box>}
    </Flex>
  );
}

// A more characterful action than a plain button: colour shift + lift on hover.
function RunButton({ onClick, loading }) {
  return (
    <chakra.button type="button" onClick={onClick} disabled={loading}
      display="inline-flex" alignItems="center" gap="2" px="6" py="2.5" borderRadius="forge" fontWeight="700" fontSize="0.9375rem"
      color="white" bg="navy" boxShadow="sm" cursor="pointer" whiteSpace="nowrap"
      transition="transform .14s cubic-bezier(.22,1,.36,1), box-shadow .14s ease, background .2s ease"
      _hover={{ bg: 'yellow', color: 'navy', transform: 'translateY(-2px)', boxShadow: 'md' }}
      _active={{ transform: 'translateY(0)' }}
      _disabled={{ opacity: 0.6, cursor: 'default', transform: 'none', bg: 'navy', color: 'white' }}
      css={{ '@media (prefers-reduced-motion: reduce)': { transition: 'none' } }}>
      {loading && <Spinner size="sm" />}
      {loading ? 'Running' : 'Run report'}
    </chakra.button>
  );
}

// Whole-toolbar placeholder while branch lists load (mirrors the changelog form skeleton).
function ControlsSkeleton() {
  const Fld = ({ flex }) => (
    <Box flex={flex}><Skeleton h="0.75rem" w="4.5rem" mb="2" /><Skeleton h="2.75rem" borderRadius="forge" /></Box>
  );
  return (
    <Flex gap={{ base: '4', lg: '6' }} align="flex-end" wrap="wrap">
      <Fld flex="1 1 12rem" /><Fld flex="1 1 10rem" /><Fld flex="1 1 10rem" />
      <Box ml={{ lg: 'auto' }}><Skeleton h="2.75rem" w="8.5rem" borderRadius="forge" /></Box>
    </Flex>
  );
}

const RepoMark = ({ repo }) => (repo === 'core' ? <CoreIcon size={18} /> : <GutenbergIcon size={18} />);

// Small round avatar with a coloured-dot fallback.
function Avatar({ src, color, size = 22 }) {
  const [ok, setOk] = useState(true);
  if (src && ok) return <chakra.img src={src} alt="" onError={() => setOk(false)} w={`${size}px`} h={`${size}px`} borderRadius="full" flex="none" objectFit="cover" bg="ui.sunk" />;
  return <Box w={`${size}px`} h={`${size}px`} borderRadius="full" bg={color || NAVY} flex="none" />;
}

// Save a Blob under a filename via a throwaway <a download>.
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportSvg(svg, name) { saveBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), name + '.svg'); }
// Rasterise the SVG to a crisp @2x PNG in the browser — no dependency.
function exportPng(svg, name, scale = 2) {
  const img = new Image();
  img.onload = () => {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const canvas = document.createElement('canvas');
    canvas.width = w * scale; canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((b) => b && saveBlob(b, name + '.png'), 'image/png');
  };
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

const DL_ICON = <chakra.svg viewBox="0 0 24 24" boxSize="14px" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></chakra.svg>;

// Download the current donut as an image (PNG for posts, SVG for crisp embeds).
// `build` returns the SVG lazily so it always reflects the on-screen chart.
function ExportChart({ build, name }) {
  const btn = {
    display: 'inline-flex', alignItems: 'center', gap: '1.5', px: '3', py: '1.5', borderRadius: 'forge',
    fontSize: '0.8125rem', fontWeight: '600', cursor: 'pointer', borderWidth: '1px', borderColor: 'ui.border',
    bg: 'ui.surface', color: 'ui.text', whiteSpace: 'nowrap', transition: 'border-color .12s, color .12s',
    _hover: { borderColor: 'ui.primary', color: 'ui.heading' },
  };
  return (
    <HStack gap="2">
      <chakra.button type="button" onClick={() => exportPng(build(), name)} {...btn}>{DL_ICON} PNG</chakra.button>
      <chakra.button type="button" onClick={() => exportSvg(build(), name)} {...btn}>SVG</chakra.button>
    </HStack>
  );
}

// Turn a report section into { headers, rows } of plain values, capped to `limit` rows.
function exportTable(report, section, limit) {
  const n = Math.max(1, Number(limit) || 1);
  const cap = (arr) => arr.slice(0, n);
  if (section === 'companies') {
    return { headers: ['rank', 'company', 'contributions', 'people'],
      rows: cap(report.companies?.byCompany || []).map((c, i) => [i + 1, c.company, c.contributions, c.people]) };
  }
  if (section === 'committers') {
    return { headers: ['rank', 'account', 'name', 'company', 'member_since', 'commits', 'percent'],
      rows: cap(report.committers || []).map((c, i) => [i + 1, c.login, c.name, c.employer || '', c.memberSince || '', c.commits, c.pct]) };
  }
  if (section === 'components') {
    return { headers: ['component', 'changes'],
      rows: cap(report.components?.byComponent || []).map((c) => [c.component, c.count]) };
  }
  return { headers: ['rank', 'name', 'employer', 'props', 'core', 'gutenberg', 'source'],
    rows: cap(report.byContributor || []).map((p, i) => [i + 1, p.name, p.employer || '', p.props, p.core, p.gutenberg, p.source]) };
}

const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCsv = ({ headers, rows }) => [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
const mdRow = (cells) => '| ' + cells.map((c) => String(c ?? '')).join(' | ') + ' |';
const toMarkdownTable = ({ headers, rows }) => [mdRow(headers), mdRow(headers.map(() => '---')), ...rows.map(mdRow)].join('\n');

// Download report data as Markdown or CSV: pick a section, how many rows, format.
function ExportData({ report, sections }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState(sections[0].value);
  const [rows, setRows] = useState(50);
  const [format, setFormat] = useState('md');
  const lbl = { fontSize: '0.6875rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'ui.muted', mb: '1.5', display: 'block' };
  const field = { w: 'full', px: '2.5', py: '2', borderWidth: '1px', borderColor: 'ui.border', borderRadius: 'forge', bg: 'ui.bg', color: 'ui.text', fontSize: '0.8125rem' };
  const doExport = () => {
    const table = exportTable(report, section, rows);
    const name = `contributors-${section}-${report.meta.since.slice(0, 10)}`;
    if (format === 'csv') saveBlob(new Blob([toCsv(table)], { type: 'text/csv;charset=utf-8' }), name + '.csv');
    else saveBlob(new Blob([toMarkdownTable(table)], { type: 'text/markdown;charset=utf-8' }), name + '.md');
    setOpen(false);
  };
  return (
    <Popover.Root open={open} onOpenChange={(e) => setOpen(e.open)} positioning={{ placement: 'bottom-end', gutter: 6 }}>
      <Popover.Trigger asChild>
        <chakra.button type="button" display="inline-flex" alignItems="center" gap="1.5" px="3" py="2" borderRadius="forge"
          fontSize="0.8125rem" fontWeight="600" cursor="pointer" whiteSpace="nowrap" borderWidth="1px" transition="border-color .12s, color .12s"
          bg={open ? 'navy' : 'ui.surface'} color={open ? 'white' : 'ui.text'} borderColor={open ? 'navy' : 'ui.border'}
          _hover={open ? {} : { borderColor: 'ui.primary', color: 'ui.heading' }}>{DL_ICON} Export data</chakra.button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="forge" boxShadow="lg" w="17rem" maxW="calc(100vw - 2rem)" zIndex="1600">
            <Popover.Body p="4">
              <Text {...lbl}>Section</Text>
              <chakra.select value={section} onChange={(e) => setSection(e.target.value)} {...field} mb="3" cursor="pointer">
                {sections.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </chakra.select>
              <Text {...lbl}>Rows</Text>
              <chakra.input type="number" min="1" step="1" value={rows}
                onChange={(e) => setRows(e.target.value)} {...field} mb="3" />
              <Text {...lbl}>Format</Text>
              <Box mb="4"><Segmented value={format} onChange={setFormat} options={[{ value: 'md', label: 'Markdown' }, { value: 'csv', label: 'CSV' }]} /></Box>
              <chakra.button type="button" onClick={doExport} w="full" display="inline-flex" alignItems="center" justifyContent="center" gap="1.5"
                px="4" py="2.5" borderRadius="forge" fontWeight="700" fontSize="0.875rem" color="white" bg="navy" cursor="pointer"
                _hover={{ bg: 'yellow', color: 'navy' }} transition="background .2s, color .2s">{DL_ICON} Download</chakra.button>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}

function Donut({ data, total, unit, selected, onSelect }) {
  return (
    <Box position="relative" w="200px" h="200px" flex="none"
      css={{ '& .recharts-sector': { outline: 'none' }, '& path:focus, & g:focus, & svg:focus': { outline: 'none' } }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<TipBox kind="contributions" />} wrapperStyle={{ zIndex: 1000 }} />
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={64} outerRadius={96} paddingAngle={1.5} stroke="none"
            startAngle={90} endAngle={-270} isAnimationActive={false} onClick={(d) => onSelect && d && !d.others && onSelect(d.name)}>
            {data.map((d, i) => <Cell key={i} fill={sliceColor(d, i, selected)} cursor={d.others ? 'default' : 'pointer'} style={{ outline: 'none' }} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <Box position="absolute" inset="0" display="flex" flexDir="column" alignItems="center" justifyContent="center" pointerEvents="none">
        <chakra.b fontSize="1.75rem" fontWeight="800" color="ui.heading" lineHeight="1" fontVariantNumeric="tabular-nums">{total}</chakra.b>
        <Text fontSize="0.75rem" color="ui.muted">{unit}</Text>
      </Box>
    </Box>
  );
}

// A small "New" pill for first-time contributors.
function NewBadge() {
  return (
    <chakra.span flex="none" bg="yellow" color="navy" fontSize="0.5625rem" fontWeight="800" letterSpacing="0.04em"
      textTransform="uppercase" px="1.5" py="0.5" borderRadius="full" lineHeight="1.1">New</chakra.span>
  );
}

// One selectable row: rank badge (medal for top three), photo, name + employer, bar, value.
function RankRow({ i, person, value, max, active, onClick, noAvatar, isNew }) {
  const medal = i <= 3 ? MEDAL[i - 1] : null;
  return (
    <Flex as="button" type="button" onClick={onClick} align="center" gap="3" w="full" textAlign="left"
      px="2" py="2.5" cursor="pointer" bg={active ? 'ui.sunk' : 'transparent'}
      borderBottomWidth="1px" borderColor="ui.border" _hover={{ bg: 'ui.sunk' }} transition="background .12s">
      <Box w="1.6rem" h="1.6rem" flex="none" borderRadius="full" display="inline-flex" alignItems="center" justifyContent="center"
        bg={medal || 'transparent'} color={medal ? (i === 1 ? 'navy' : 'white') : 'ui.muted'}
        fontSize="0.8125rem" fontWeight="700" fontVariantNumeric="tabular-nums">{i}</Box>
      {!noAvatar && <Avatar src={person.avatar} color={active ? YELLOW : NAVY} />}
      <Box flex="1" minW="0">
        <Flex align="center" gap="1.5" minW="0">
          <Text color="ui.text" fontSize="0.875rem" fontWeight={active ? '700' : '500'} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{person.name}</Text>
          {isNew && <NewBadge />}
        </Flex>
        {person.employer && <Text color="ui.muted" fontSize="0.6875rem" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{person.employer}</Text>}
      </Box>
      <Box flex="0 0 3.5rem" h="7px" borderRadius="full" bg="ui.sunk" overflow="hidden">
        <Box h="full" borderRadius="full" bg={active ? YELLOW : NAVY} w={`${Math.max(6, Math.round((value / (max || 1)) * 100))}%`} />
      </Box>
      <Text w="2.25rem" textAlign="right" color="ui.heading" fontSize="0.875rem" fontWeight="700" fontVariantNumeric="tabular-nums" flex="none">{value}</Text>
    </Flex>
  );
}

function Detail({ person, repoFilter }) {
  if (!person) return null;
  const items = (person.items || []).filter((it) => repoFilter === 'all' || it.repo === repoFilter);
  const count = repoFilter === 'core' ? person.core : repoFilter === 'gutenberg' ? person.gutenberg : person.props;
  const srcLabel = person.source === 'both' ? 'Core and Gutenberg' : person.source === 'core' ? 'Core' : 'Gutenberg';
  const profileUrl = `https://profiles.wordpress.org/${encodeURIComponent(person.slug || person.name)}/`;
  return (
    <Box bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="forge" boxShadow="sm" p="5" w="full" h="full" display="flex" flexDirection="column">
      <Flex align="flex-start" gap="4" mb="4">
        <chakra.a href={profileUrl} target="_blank" rel="noopener noreferrer" flex="none" borderRadius="full" _hover={{ opacity: 0.85 }} transition="opacity .12s"><Avatar src={person.avatar} size={56} /></chakra.a>
        <Box flex="1" minW="0">
          <Flex align="baseline" justify="space-between" gap="3">
            <chakra.a href={profileUrl} target="_blank" rel="noopener noreferrer" fontSize="1.15rem" fontWeight="800" color="ui.heading"
              overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" _hover={{ color: 'ui.primary', textDecoration: 'underline' }}>{person.name}</chakra.a>
            <chakra.a href={profileUrl} target="_blank" rel="noopener noreferrer"
              color="ui.primary" fontSize="0.8125rem" fontWeight="600" whiteSpace="nowrap" flex="none" _hover={{ textDecoration: 'underline' }}>Visit profile ↗</chakra.a>
          </Flex>
          <Flex align="baseline" gap="2" mt="1">
            <chakra.b fontSize="2rem" fontWeight="800" color="ui.heading" lineHeight="1" fontVariantNumeric="tabular-nums">{count}</chakra.b>
            <Text color="ui.muted" fontSize="0.875rem">contributions · {srcLabel}</Text>
          </Flex>
          <Text color="ui.muted" fontSize="0.8125rem" mt="1.5">{person.employer ? `Works at ${person.employer}` : 'Employer not listed on wp.org'}</Text>
        </Box>
      </Flex>
      <Stack gap="0" flex="1" minH="0" overflowY="auto" pr="1"
        css={{ '&::-webkit-scrollbar': { width: '6px' }, '&::-webkit-scrollbar-thumb': { background: 'var(--chakra-colors-ui-border)', borderRadius: '3px' } }}>
        {items.map((it, i) => (
          <chakra.a key={i} href={it.url} target="_blank" rel="noopener noreferrer"
            display="flex" alignItems="center" gap="2.5" py="2" borderTopWidth={i ? '1px' : '0'} borderColor="ui.border"
            _hover={{ bg: 'ui.sunk' }} borderRadius="sm" px="1" mx="-1">
            <RepoMark repo={it.repo} />
            <Text flex="1" color="ui.text" fontSize="0.8125rem" lineHeight="1.4">{it.subject}</Text>
            <Text color="ui.muted" fontSize="0.75rem" fontVariantNumeric="tabular-nums" whiteSpace="nowrap" flex="none">{it.ref}</Text>
          </chakra.a>
        ))}
        {!items.length && <Text color="ui.muted" fontSize="0.8125rem" py="2">No itemised changes in this window.</Text>}
      </Stack>
    </Box>
  );
}

// Analytics: daily activity area chart over the window.
function Activity({ timeline, metric }) {
  return (
    <Box bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="forge" boxShadow="sm" px="4" py="4" mb="8">
      <Box h="200px" w="full" css={{ '& .recharts-cartesian-axis-tick-value': { fontSize: '10px', fill: AXIS } }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={timeline} margin={{ left: 2, right: 12, top: 6, bottom: 0 }}>
            <defs>
              <linearGradient id="uwpAct" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={NAVY} stopOpacity={0.32} />
                <stop offset="100%" stopColor={NAVY} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,.18)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmtDay} minTickGap={26} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: AXIS }} />
            <YAxis allowDecimals={false} width={34} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: AXIS }} />
            <Tooltip content={<TipBox dated kind={metric === 'contributors' ? 'contributors' : 'contributions'} />} wrapperStyle={{ zIndex: 1000 }} />
            <Area type="monotone" dataKey={metric} stroke={NAVY} strokeWidth={2} fill="url(#uwpAct)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}

// The people who work at the selected company.
function CompanyMembers({ company, members }) {
  if (!company) return null;
  return (
    <Box bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="forge" boxShadow="sm" p="5" w="full">
      <Text fontSize="1.15rem" fontWeight="800" color="ui.heading" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{company}</Text>
      <Text color="ui.muted" fontSize="0.8125rem" mb="3">{members.length} {members.length === 1 ? 'contributor' : 'contributors'}</Text>
      <Stack gap="0" flex="1" minH="0" overflowY="auto" pr="1"
        css={{ '&::-webkit-scrollbar': { width: '6px' }, '&::-webkit-scrollbar-thumb': { background: 'var(--chakra-colors-ui-border)', borderRadius: '3px' } }}>
        {members.map((p, i) => (
          <Flex key={p.name} align="center" gap="2.5" py="2" borderTopWidth={i ? '1px' : '0'} borderColor="ui.border">
            <Avatar src={p.avatar} />
            <chakra.a href={`https://profiles.wordpress.org/${encodeURIComponent(p.slug || p.name)}/`} target="_blank" rel="noopener noreferrer"
              flex="1" minW="0" color="ui.text" fontSize="0.875rem" fontWeight="500" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap"
              _hover={{ color: 'ui.primary', textDecoration: 'underline' }}>{p.name}</chakra.a>
            <Text color="ui.heading" fontSize="0.875rem" fontWeight="700" fontVariantNumeric="tabular-nums" flex="none">{p.props}</Text>
          </Flex>
        ))}
        {!members.length && <Text color="ui.muted" fontSize="0.8125rem" py="2">No contributors resolved to this company.</Text>}
      </Stack>
    </Box>
  );
}

function LoadingState() {
  return (
    <>
      <Flex align="center" gap="2.5" mb="6" mt="2" color="ui.muted" fontSize="0.9375rem">
        <Spinner size="sm" color="navy" flex="none" />
        <Text>Fetching commits and resolving contributor profiles…</Text>
      </Flex>
      <SimpleGrid minChildWidth="10.5rem" gap="4" mb="6">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h="4.75rem" borderRadius="forge" />)}</SimpleGrid>
      <Skeleton h="12rem" borderRadius="forge" mb="8" />
      <Flex gap="8" wrap="wrap">
        <Stack flex="1 1 20rem" gap="2.5">
          <Skeleton w="200px" h="200px" borderRadius="full" mx="auto" mb="2" />
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} h="2.25rem" borderRadius="forge" />)}
        </Stack>
        <Skeleton flex="1 1 20rem" h="22rem" borderRadius="forge" />
      </Flex>
    </>
  );
}

function EmptyState() {
  return (
    <Box mt="4"><Box textAlign="center" py="16" px="5">
      <chakra.img src="/brand/bulb.svg" alt="" w="3.5rem" h="3.5rem" opacity="0.95" mb="4" mx="auto" />
      <Heading as="h3" fontSize="1.125rem" color="ui.heading" fontWeight="700" mb="2">No contributors yet</Heading>
      <Text mx="auto" maxW="52ch" color="ui.muted" fontSize="0.9688rem" lineHeight="1.6">
        Pick a period, then run the report. You get activity over time, the top contributors with their employer, what each person shipped, and which company invested most.
      </Text>
    </Box></Box>
  );
}

// Core changes grouped by Trac component (from the active-cycle dev-notes
// tracker). Uncategorized changes are summarised in the note, not the bars.
function Components({ data }) {
  const rows = data.byComponent.filter((c) => c.component !== 'Uncategorized').slice(0, 12);
  if (!rows.length) return null;
  const max = rows[0].count || 1;
  return (
    <Box mt="10">
      <Heading as="h3" fontSize="1rem" fontWeight="700" color="ui.heading" mb="1">Core changes by component</Heading>
      <Text color="ui.muted" fontSize="0.8125rem" mb="4">
        Categorized {data.coverage.known} of {data.coverage.total} Core changes ({data.coverage.pct}%) via the {data.slug} tracker. Changes on tickets not triaged there yet aren't shown.
      </Text>
      <Stack gap="2.5">
        {rows.map((c) => (
          <Flex key={c.component} align="center" gap="3">
            <Text w={{ base: '7.5rem', md: '10rem' }} flex="none" fontSize="0.8125rem" color="ui.text" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">{c.component}</Text>
            <Box flex="1" h="8px" bg="ui.sunk" borderRadius="full" overflow="hidden">
              <Box h="full" borderRadius="full" bg="navy" w={`${Math.max(4, Math.round((c.count / max) * 100))}%`} />
            </Box>
            <Box w="2.5rem" flex="none" textAlign="right" fontSize="0.8125rem" fontWeight="700" color="ui.heading" fontVariantNumeric="tabular-nums">{c.count}</Box>
          </Flex>
        ))}
      </Stack>
    </Box>
  );
}

// Detail card for the selected Core committer: profile, company, join year, and
// the changesets they landed. Mirrors the contributor Detail structure.
function CommitterDetail({ committer }) {
  if (!committer) return null;
  const c = committer;
  const items = c.items || [];
  const profileUrl = `https://profiles.wordpress.org/${encodeURIComponent(c.login)}/`;
  return (
    <Box bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="forge" boxShadow="sm" p="5" w="full" h="full" display="flex" flexDirection="column">
      <Flex align="flex-start" gap="4" mb="4">
        <chakra.a href={profileUrl} target="_blank" rel="noopener noreferrer" flex="none" borderRadius="full" _hover={{ opacity: 0.85 }} transition="opacity .12s"><Avatar src={c.avatar} size={56} /></chakra.a>
        <Box flex="1" minW="0">
          <Flex align="baseline" justify="space-between" gap="3">
            <chakra.a href={profileUrl} target="_blank" rel="noopener noreferrer" fontSize="1.15rem" fontWeight="800" color="ui.heading"
              overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" _hover={{ color: 'ui.primary', textDecoration: 'underline' }}>{c.login}</chakra.a>
            <chakra.a href={profileUrl} target="_blank" rel="noopener noreferrer"
              color="ui.primary" fontSize="0.8125rem" fontWeight="600" whiteSpace="nowrap" flex="none" _hover={{ textDecoration: 'underline' }}>Visit profile ↗</chakra.a>
          </Flex>
          <Flex align="baseline" gap="2" mt="1">
            <chakra.b fontSize="2rem" fontWeight="800" color="ui.heading" lineHeight="1" fontVariantNumeric="tabular-nums">{c.commits}</chakra.b>
            <Text color="ui.muted" fontSize="0.875rem">commits landed{c.name && c.name.toLowerCase() !== c.login.toLowerCase() ? ` · ${c.name}` : ''}</Text>
          </Flex>
          <Text color="ui.muted" fontSize="0.8125rem" mt="1.5">
            {c.employer ? `Works at ${c.employer}` : 'Employer not listed'}{c.memberSince ? ` · Member since ${c.memberSince}` : ''}
          </Text>
        </Box>
      </Flex>
      <Stack gap="0" flex="1" minH="0" overflowY="auto" pr="1"
        css={{ '&::-webkit-scrollbar': { width: '6px' }, '&::-webkit-scrollbar-thumb': { background: 'var(--chakra-colors-ui-border)', borderRadius: '3px' } }}>
        {items.map((it, i) => (
          <chakra.a key={i} href={it.url} target="_blank" rel="noopener noreferrer"
            display="flex" alignItems="center" gap="2.5" py="2" borderTopWidth={i ? '1px' : '0'} borderColor="ui.border"
            _hover={{ bg: 'ui.sunk' }} borderRadius="sm" px="1" mx="-1">
            <RepoMark repo={it.repo} />
            <Text flex="1" color="ui.text" fontSize="0.8125rem" lineHeight="1.4">{it.subject}</Text>
            <Text color="ui.muted" fontSize="0.75rem" fontVariantNumeric="tabular-nums" whiteSpace="nowrap" flex="none">{it.ref}</Text>
          </chakra.a>
        ))}
        {!items.length && <Text color="ui.muted" fontSize="0.8125rem" py="2">No changesets in this window.</Text>}
      </Stack>
    </Box>
  );
}

// Core committers: who actually landed the changesets (distinct from Props credit).
// Same structure as the Contributors tab: donut + selectable ranked list + detail.
function Committers({ list: rawList, meta, search, setSearch }) {
  const [sel, setSel] = useState(null);
  const [page, setPage] = useState(0);
  const q = (search || '').trim().toLowerCase();
  const list = useMemo(() => (rawList || []).filter((c) => !q || c.login.toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q)), [rawList, q]);
  useEffect(() => { setPage(0); setSel(null); }, [list]);
  const PAGE = 20;
  const pool = useMemo(() => list.slice(0, 100), [list]);
  const slices = useMemo(() => toSlices(list.map((c) => ({ name: c.login, value: c.commits })), 8), [list]);
  if (!rawList?.length) return <Text color="ui.muted" fontSize="0.875rem" mb="6">No committer data for this window.</Text>;
  const max = list[0]?.commits || 1;
  const totalPages = Math.max(1, Math.ceil(pool.length / PAGE));
  const pageItems = pool.slice(page * PAGE, page * PAGE + PAGE);
  const selCom = list.find((c) => c.login === sel) || list[0];
  return (
    <>
      <Flex justify="flex-end" align="center" gap="3" mb="4" wrap="wrap">
        <Box mr={{ md: 'auto' }}>
          <ExportChart name={`committers-${meta.since.slice(0, 10)}`}
            build={() => donutSvg(slices, { title: `Core committers · ${meta.since.slice(0, 10)} to ${meta.until.slice(0, 10)}`, total: list.length, unit: 'committers' })} />
        </Box>
        <Box w={{ base: 'full', sm: '12rem' }}><TextInput value={search} placeholder="Filter by name…" onChange={(e) => setSearch(e.target.value)} /></Box>
      </Flex>
      {list.length ? (
        <Flex direction={{ base: 'column', xl: 'row' }} gap="8" align="stretch" mb="4">
          <Box flex="1 1 0" minW="0" w="full">
            <Flex justify="center" mb="6"><Donut data={slices} total={list.length} unit="committers" selected={selCom?.login} onSelect={setSel} /></Flex>
            <Stack gap="0">
              {pageItems.map((c, i) => (
                <RankRow key={c.login} i={page * PAGE + i + 1} person={{ name: c.login, avatar: c.avatar, employer: c.employer }} value={c.commits} max={max}
                  active={selCom?.login === c.login} onClick={() => setSel(c.login)} />
              ))}
            </Stack>
            {totalPages > 1 && (
              <Flex align="center" justify="center" gap="1.5" mt="5" wrap="wrap">
                {Array.from({ length: totalPages }, (_, n) => (
                  <chakra.button key={n} type="button" onClick={() => setPage(n)}
                    minW="2rem" px="2" py="1.5" borderRadius="forge" fontSize="0.8125rem" fontWeight={n === page ? '700' : '500'} cursor="pointer"
                    fontVariantNumeric="tabular-nums" bg={n === page ? 'navy' : 'ui.sunk'} color={n === page ? 'white' : 'ui.text'}
                    borderWidth="1px" borderColor={n === page ? 'navy' : 'ui.border'} _hover={n === page ? {} : { borderColor: 'ui.primary' }}>{n + 1}</chakra.button>
                ))}
              </Flex>
            )}
          </Box>
          <Box flex="1 1 0" minW="0" w="full"><CommitterDetail committer={selCom} /></Box>
        </Flex>
      ) : <Text color="ui.muted" fontSize="0.875rem" mb="6">No matching committers.</Text>}
    </>
  );
}

export default function Contributors() {
  const core = useCore() || {};
  const periods = useMemo(() => buildPeriods(new Date()), []);
  const firstQuarter = periods.find((p) => p.value.startsWith('q-')) || periods[1];
  const [periodVal, setPeriodVal] = useState(firstQuarter.value);
  const [since, setSince] = useState(firstQuarter.since);
  const [until, setUntil] = useState(firstQuarter.until);
  const [gbBranch, setGbBranch] = useState('trunk');
  const [coreBranch, setCoreBranch] = useState('trunk');
  const [gbBranches, setGbBranches] = useState(['trunk']);
  const [coreBranches, setCoreBranches] = useState(['trunk']);
  const [repoFilter, setRepoFilter] = useState('all');
  const [chartMetric, setChartMetric] = useState('contributions');
  const [tab, setTab] = useState('contributors');
  const [page, setPage] = useState(0);
  const [selCompany, setSelCompany] = useState(null);
  const [coPage, setCoPage] = useState(0);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [firstTimers, setFirstTimers] = useState(null); // { loading, count, names:Set } | null
  const [newOnly, setNewOnly] = useState(false);
  const custom = periodVal === 'custom';

  function onPeriod(v) {
    setPeriodVal(v);
    if (v === 'custom') { const t = todayIso(); setUntil((u) => (u > t ? t : u)); return; } // don't open the picker on a future month
    const p = periods.find((x) => x.value === v);
    if (p && p.since) { setSince(p.since); setUntil(p.until); }
  }

  useEffect(() => {
    let live = true;
    (async () => {
      await Promise.all([['gutenberg', setGbBranches], ['core', setCoreBranches]].map(async ([repo, set]) => {
        try {
          const { ok, data: b } = await fetchJSON('/api/contributors/branches?repo=' + repo);
          if (live && ok && b.branches && b.branches.length) set(b.branches);
        } catch { /* keep the trunk default */ }
      }));
      if (live) setBranchesLoading(false);
    })();
    return () => { live = false; };
  }, []);

  const run = useCallback(async () => {
    if (!since || !until) { setError('Pick a period first.'); return; }
    setError(''); setLoading(true); setData(null); setSelected(null);
    const qs = new URLSearchParams({ since, until, gbBranch, coreBranch });
    try {
      const { ok, data: body } = await fetchJSON('/api/contributors?' + qs.toString());
      if (!ok) setError(body.error || 'Request failed');
      else {
        setData(body);
        setSelected(body.report?.byContributor?.[0]?.name || null);
        setSelCompany(body.report?.companies?.byCompany?.[0]?.company || null);
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [since, until, gbBranch, coreBranch]);

  useEffect(() => { setPage(0); setCoPage(0); }, [repoFilter, search, data, newOnly]);

  const report = data && data.report;

  // First-timers load progressively (the historical lookback is slow) so the main
  // report shows immediately. New = in this window, absent from the prior 12 months.
  useEffect(() => {
    if (!report) { setFirstTimers(null); setNewOnly(false); return; }
    let live = true;
    setFirstTimers({ loading: true, count: 0, names: new Set() });
    setNewOnly(false);
    const qs = new URLSearchParams({ since: report.meta.since.slice(0, 10), until: report.meta.until.slice(0, 10), gbBranch: report.meta.gbBranch, coreBranch: report.meta.coreBranch, months: '12' });
    fetchJSON('/api/contributors/prior?' + qs.toString()).then(({ ok, data: b }) => {
      if (!live) return;
      if (!ok) { setFirstTimers({ loading: false, count: 0, names: new Set(), failed: true }); return; }
      const prior = new Set((b.names || []).map((n) => n.toLowerCase()));
      const names = new Set(report.byContributor.filter((p) => !prior.has(p.name.toLowerCase())).map((p) => p.name.toLowerCase()));
      setFirstTimers({ loading: false, count: names.size, names, lookback: b });
    }).catch(() => { if (live) setFirstTimers({ loading: false, count: 0, names: new Set(), failed: true }); });
    return () => { live = false; };
  }, [report]);
  const isNew = useCallback((name) => !!firstTimers && !firstTimers.loading && firstTimers.names.has(name.toLowerCase()), [firstTimers]);
  const q = search.trim().toLowerCase();
  const valueOf = (p) => (repoFilter === 'core' ? p.core : repoFilter === 'gutenberg' ? p.gutenberg : p.props);
  const people = useMemo(() => (!report ? [] : report.byContributor
    .filter((c) => valueOf(c) > 0)
    .filter((c) => !q || c.name.toLowerCase().includes(q))
    .filter((c) => !newOnly || isNew(c.name))
    .sort((a, b) => valueOf(b) - valueOf(a))), [report, q, repoFilter, newOnly, isNew]);
  const listMax = people.length ? valueOf(people[0]) : 1;
  const list = useMemo(() => people.slice(0, 20).map((p) => ({ name: p.name, value: valueOf(p) })), [people, repoFilter]);
  const slices = useMemo(() => toSlices(list, 8), [list]);
  const PAGE = 20;
  const pool = useMemo(() => people.slice(0, 100), [people]); // rank up to 100
  const totalPages = Math.max(1, Math.ceil(pool.length / PAGE));
  const pageItems = pool.slice(page * PAGE, page * PAGE + PAGE);
  const selPerson = useMemo(() => people.find((c) => c.name === selected) || people[0] || null, [people, selected]);

  const co = report && report.companies;
  const coList = useMemo(() => (!co ? [] : co.byCompany.filter((c) => !q || c.company.toLowerCase().includes(q)).map((c) => ({ name: c.company, value: c.contributions }))), [co, q]);
  const coSlices = useMemo(() => toSlices(coList, 6), [coList]);
  const coMax = coList.length ? coList[0].value : 1;
  const coPool = useMemo(() => coList.slice(0, 100), [coList]);
  const coTotalPages = Math.max(1, Math.ceil(coPool.length / PAGE));
  const coPageItems = coPool.slice(coPage * PAGE, coPage * PAGE + PAGE);
  const companyMembers = useMemo(() => {
    if (!report || !selCompany) return [];
    const isUnknown = selCompany === 'Unknown / not listed';
    const key = coKey(selCompany);
    return report.byContributor
      .filter((p) => (isUnknown ? canonCompany(p.employer) == null : coKey(p.employer) === key))
      .sort((a, b) => b.props - a.props);
  }, [report, selCompany]);

  const exportSections = useMemo(() => {
    const s = [{ value: 'contributors', label: 'Contributors' }];
    if (co) s.push({ value: 'companies', label: 'Companies' });
    if (report?.committers?.length) s.push({ value: 'committers', label: 'Core committers' });
    if (report?.components?.byComponent?.length) s.push({ value: 'components', label: 'Components' });
    return s;
  }, [report, co]);

  return (
    <>
      <Box bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="forge" boxShadow="sm" px="6" py="6" mb="8">
        {branchesLoading ? <ControlsSkeleton /> : (
          <Flex gap={{ base: '4', lg: '6' }} align="flex-end" wrap="wrap">
            <Field label="Period">
              <Select block searchable ariaLabel="Period" value={periodVal} onChange={onPeriod}
                options={periods.map((p) => ({ value: p.value, label: p.label }))} placeholder="Select" />
            </Field>
            {custom && <DateRangePicker since={since} until={until} onChange={(a, b) => { setSince(a); setUntil(b); }} />}
            <Field label="Gutenberg branch">
              <Select block searchable ariaLabel="Gutenberg branch" value={gbBranch} onChange={setGbBranch}
                options={gbBranches.map((b) => ({ value: b, label: b }))} placeholder="trunk" />
            </Field>
            <Field label="Core branch">
              <Select block searchable ariaLabel="Core branch" value={coreBranch} onChange={setCoreBranch}
                options={coreBranches.map((b) => ({ value: b, label: b }))} placeholder="trunk" />
            </Field>
            <Box pb="0.5" ml={{ lg: 'auto' }}><RunButton onClick={run} loading={loading} /></Box>
          </Flex>
        )}
      </Box>

      {error && <Box mb="4" color="ui.bad" fontSize="0.875rem">{error}</Box>}

      {loading ? <LoadingState /> : !report ? <EmptyState /> : (
        <>
          <SimpleGrid minChildWidth="10.5rem" gap="4" mb="2">
            <StatCard n={report.totals.contributors} label="Contributors" counted />
            <StatCard n={report.totals.coreCommits} label="Core changes" />
            <StatCard n={report.totals.gutenbergCommits} label="Gutenberg changes" />
            <StatCard n={co ? co.byCompany.length : report.totals.coreCommits + report.totals.gutenbergCommits} label={co ? 'Companies' : 'Total changes'} />
          </SimpleGrid>
          <Text color="ui.muted" fontSize="0.75rem" pt="2" mb="1.5" lineHeight="1.5">Counts only merged changes (Core changesets, Gutenberg merges). Open PRs, reverts and release plumbing are excluded.</Text>
          {report.tickets ? (
            <Text color="ui.muted" fontSize="0.75rem" mb="6" lineHeight="1.5">
              Trac this window: <chakra.b color="ui.heading">{report.tickets.opened}</chakra.b> tickets opened · <chakra.b color="ui.heading">{report.tickets.closed}</chakra.b> closed{report.tickets.closedApprox ? ' (by last change; Trac has no close-date field)' : ''}.
            </Text>
          ) : report.tickets === null ? (
            <Text color="ui.muted" fontSize="0.75rem" mb="6" lineHeight="1.5">Connect WordPress.org in Settings to see Trac ticket activity (opened / closed).</Text>
          ) : <Box mb="6" />}

          {report.timeline && report.timeline.length > 1 && (
            <>
              <Flex align="center" justify="space-between" gap="3" mb="3" wrap="wrap">
                <Text fontSize="1.05rem" fontWeight="700" color="ui.heading">Activity over time</Text>
                <Segmented options={[{ value: 'contributions', label: 'Contributions' }, { value: 'contributors', label: 'Contributors' }]} value={chartMetric} onChange={setChartMetric} />
              </Flex>
              <Activity timeline={report.timeline} metric={chartMetric} />
            </>
          )}

          <TabBar value={tab} onChange={setTab}
            right={<ExportData report={report} sections={exportSections} />}
            tabs={[
              { value: 'contributors', label: 'Contributors' },
              { value: 'companies', label: 'Companies' },
              ...(report.committers?.length ? [{ value: 'committers', label: 'Core committers' }] : []),
            ]} />

          {tab === 'contributors' ? (
            <>
              <Flex justify="flex-end" align="center" gap="3" mb="4" wrap="wrap">
                <Box mr={{ md: 'auto' }}>
                  <ExportChart name={`contributors-${report.meta.since.slice(0, 10)}`}
                    build={() => donutSvg(slices, { title: `Top contributors · ${report.meta.since.slice(0, 10)} to ${report.meta.until.slice(0, 10)}`, total: report.totals.contributors, unit: 'people' })} />
                </Box>
                <Segmented value={repoFilter} onChange={setRepoFilter} options={[
                  { value: 'all', label: 'All' },
                  { value: 'core', label: <><CoreIcon size={14} /> Core</> },
                  { value: 'gutenberg', label: <><GutenbergIcon size={14} /> Gutenberg</> },
                ]} />
                {firstTimers && (firstTimers.loading || firstTimers.count > 0) && (
                  <chakra.button type="button" onClick={() => setNewOnly((v) => !v)} disabled={firstTimers.loading}
                    display="inline-flex" alignItems="center" gap="1.5" px="3" py="2" borderRadius="forge" fontSize="0.8125rem" fontWeight="600"
                    cursor={firstTimers.loading ? 'default' : 'pointer'} whiteSpace="nowrap" borderWidth="1px"
                    bg={newOnly ? 'navy' : 'ui.surface'} color={newOnly ? 'white' : 'ui.text'} borderColor={newOnly ? 'navy' : 'ui.border'}
                    _hover={firstTimers.loading || newOnly ? {} : { borderColor: 'ui.primary' }} title="First contribution in this window (none in the prior 12 months)">
                    {firstTimers.loading ? <><Spinner size="xs" borderWidth="1.5px" /> Finding new…</> : <>New only ({firstTimers.count})</>}
                  </chakra.button>
                )}
                <Box w={{ base: 'full', sm: '12rem' }}><TextInput value={search} placeholder="Filter by name…" onChange={(e) => setSearch(e.target.value)} /></Box>
              </Flex>
              {list.length ? (
                <Flex direction={{ base: 'column', xl: 'row' }} gap="8" align="stretch" mb="4">
                  <Box flex="1 1 0" minW="0" w="full">
                    <Flex justify="center" mb="6"><Donut data={slices} total={report.totals.contributors} unit="people" selected={selPerson?.name} onSelect={setSelected} /></Flex>
                    <Stack gap="0">
                      {pageItems.map((p, i) => (
                        <RankRow key={p.name} i={page * PAGE + i + 1} person={p} value={valueOf(p)} max={listMax}
                          active={selPerson?.name === p.name} onClick={() => setSelected(p.name)} isNew={isNew(p.name)} />
                      ))}
                    </Stack>
                    {totalPages > 1 && (
                      <Flex align="center" justify="center" gap="1.5" mt="5" wrap="wrap">
                        {Array.from({ length: totalPages }, (_, n) => (
                          <chakra.button key={n} type="button" onClick={() => setPage(n)}
                            minW="2rem" px="2" py="1.5" borderRadius="forge" fontSize="0.8125rem" fontWeight={n === page ? '700' : '500'} cursor="pointer"
                            fontVariantNumeric="tabular-nums" bg={n === page ? 'navy' : 'ui.sunk'} color={n === page ? 'white' : 'ui.text'}
                            borderWidth="1px" borderColor={n === page ? 'navy' : 'ui.border'} _hover={n === page ? {} : { borderColor: 'ui.primary' }}>{n + 1}</chakra.button>
                        ))}
                      </Flex>
                    )}
                  </Box>
                  <Box flex="1 1 0" minW="0" w="full"><Detail person={selPerson} repoFilter={repoFilter} /></Box>
                </Flex>
              ) : <Text color="ui.muted" fontSize="0.875rem" mb="6">No matching contributors.</Text>}
              {report.components && <Components data={report.components} />}
            </>
          ) : tab === 'committers' ? (
            <Committers list={report.committers} meta={report.meta} search={search} setSearch={setSearch} />
          ) : co && coList.length > 0 ? (
            <>
              <Flex justify="flex-end" align="center" gap="3" mb="4" wrap="wrap">
                <Box mr={{ md: 'auto' }}>
                  <ExportChart name={`companies-${report.meta.since.slice(0, 10)}`}
                    build={() => donutSvg(coSlices, { title: `Companies by contributions · ${report.meta.since.slice(0, 10)} to ${report.meta.until.slice(0, 10)}`, total: co.byCompany.length, unit: 'companies' })} />
                </Box>
                <Box w={{ base: 'full', sm: '12rem' }}><TextInput value={search} placeholder="Filter by name…" onChange={(e) => setSearch(e.target.value)} /></Box>
              </Flex>
              <Text color="ui.muted" fontSize="0.8125rem" mb="4">
                Employer known for {co.coverage.peopleKnown} of {co.coverage.peopleTotal} people ({co.coverage.pct}%). Click a company to see its contributors. Location is not published on wp.org profiles.
              </Text>
              <Flex direction={{ base: 'column', xl: 'row' }} gap="8" align="stretch" mb="4">
                <Box flex="1 1 0" minW="0" w="full">
                  <Flex justify="center" mb="6"><Donut data={coSlices} total={co.byCompany.length} unit="companies" selected={selCompany} onSelect={setSelCompany} /></Flex>
                  <Stack gap="0">
                    {coPageItems.map((r, i) => (
                      <RankRow key={r.name} i={coPage * PAGE + i + 1} person={{ name: r.name }} value={r.value} max={coMax} noAvatar
                        active={selCompany === r.name} onClick={() => setSelCompany(r.name)} />
                    ))}
                  </Stack>
                  {coTotalPages > 1 && (
                    <Flex align="center" justify="center" gap="1.5" mt="5" wrap="wrap">
                      {Array.from({ length: coTotalPages }, (_, n) => (
                        <chakra.button key={n} type="button" onClick={() => setCoPage(n)}
                          minW="2rem" px="2" py="1.5" borderRadius="forge" fontSize="0.8125rem" fontWeight={n === coPage ? '700' : '500'} cursor="pointer"
                          fontVariantNumeric="tabular-nums" bg={n === coPage ? 'navy' : 'ui.sunk'} color={n === coPage ? 'white' : 'ui.text'}
                          borderWidth="1px" borderColor={n === coPage ? 'navy' : 'ui.border'} _hover={n === coPage ? {} : { borderColor: 'ui.primary' }}>{n + 1}</chakra.button>
                      ))}
                    </Flex>
                  )}
                </Box>
                <Box flex="1 1 0" minW="0" w="full"><CompanyMembers company={selCompany} members={companyMembers} /></Box>
              </Flex>
            </>
          ) : <Text color="ui.muted" fontSize="0.875rem" mb="6">No company data for this window.</Text>}
        </>
      )}
    </>
  );
}
