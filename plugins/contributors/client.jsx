// Contributors — client side of the bundled UnleashWP core plugin. An analytics
// view of who contributed to WordPress Core + Gutenberg in a period: activity
// over time, a donut of the top people, a selectable ranked list (with photo and
// employer), what each person shipped, and which company invested most.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Flex, Heading, HStack, SimpleGrid, Spinner, Stack, Skeleton, Text, chakra } from '@chakra-ui/react';
import { PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useCore, fetchJSON } from '../../src/client/core.jsx';
import { TextInput, Select, DateRangePicker } from '../../src/client/ui';
import { CoreIcon, GutenbergIcon } from '../../src/client/wp-icons.jsx';

// UnleashWP brand: navy ramp + yellow accent. Selected slice/row turns yellow.
const NAVY = '#203159';
const YELLOW = '#fcbe00';
const RAMP = ['#203159', '#2a3f6f', '#3c4e7d', '#4a5c8c', '#5d6f9f', '#7385b0', '#8f9dc4', '#aab6d6'];
const OTHERS = '#c3cadb';
const MEDAL = ['#fcbe00', '#b9c2d1', '#cd7f4f']; // gold, silver, bronze for the top three
const AXIS = 'var(--chakra-colors-fg)';          // resolves + adapts to light/dark
const pad = (n) => String(n).padStart(2, '0');

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

// Best-effort company logo: wp.org has none, so we guess a domain from the name
// and use Google's favicon service. Curated map for the tricky multi-word names;
// single-word brands are guessed as <name>.com; anything ambiguous stays a dot.
const LOGO_MAP = {
  'wp engine': 'wpengine.com', 'human made': 'humanmade.com', 'human made ltd': 'humanmade.com',
  'awesome motive': 'awesomemotive.com', 'parshipmeet group': 'parshipmeet.com', 'wordpress': 'wordpress.org',
  'accessible web design': 'accessiblewebdesign.us', 'digicube ag': 'digicube.ch', 'buzz geek llc': 'buzzgeek.com',
  'addweb solution': 'addwebsolution.com', 'yith': 'yithemes.com', 'a8c': 'automattic.com',
};
const NON_COMPANY = /^(unknown|self.?employed|open to work|freelanc|not listed|n\/a)/i;
function companyLogo(name) {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  if (NON_COMPANY.test(key)) return null;
  let domain = LOGO_MAP[key];
  if (!domain) {
    const base = key.replace(/[.,]/g, '').replace(/\b(inc|llc|ltd|gmbh|ag|co|corp|group|incorporated|limited|company)\b/g, '').trim();
    if (/\s/.test(base) || base.length < 2) return null; // multi-word is too ambiguous to guess
    domain = base.replace(/[^a-z0-9]/g, '') + '.com';
  }
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

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
function TabBar({ tabs, value, onChange }) {
  return (
    <Flex gap="1" borderBottomWidth="1px" borderColor="ui.border" mb="6">
      {tabs.map((t) => (
        <chakra.button key={t.value} type="button" onClick={() => onChange(t.value)}
          px="4" py="2.5" fontSize="0.9375rem" fontWeight={value === t.value ? '700' : '500'} cursor="pointer"
          color={value === t.value ? 'ui.heading' : 'ui.muted'} borderBottomWidth="2px" mb="-1px"
          borderColor={value === t.value ? 'navy' : 'transparent'} transition="color .12s, border-color .12s" _hover={{ color: 'ui.heading' }}>
          {t.label}
        </chakra.button>
      ))}
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

const RepoMark = ({ repo }) => (repo === 'core' ? <CoreIcon size={18} /> : <GutenbergIcon size={18} />);

// Small round avatar with a coloured-dot fallback.
function Avatar({ src, color, size = 22 }) {
  const [ok, setOk] = useState(true);
  if (src && ok) return <chakra.img src={src} alt="" onError={() => setOk(false)} w={`${size}px`} h={`${size}px`} borderRadius="full" flex="none" objectFit="cover" bg="ui.sunk" />;
  return <Box w={`${size}px`} h={`${size}px`} borderRadius="full" bg={color || NAVY} flex="none" />;
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

// One selectable row: rank badge (medal for top three), photo, name + employer, bar, value.
function RankRow({ i, person, value, max, active, onClick }) {
  const medal = i <= 3 ? MEDAL[i - 1] : null;
  return (
    <Flex as="button" type="button" onClick={onClick} align="center" gap="3" w="full" textAlign="left"
      px="2.5" py="2" borderRadius="forge" cursor="pointer" bg={active ? 'ui.sunk' : 'transparent'}
      borderWidth="1px" borderColor={active ? 'ui.border' : 'transparent'} _hover={{ bg: 'ui.sunk' }} transition="background .12s">
      <Box w="1.6rem" h="1.6rem" flex="none" borderRadius="full" display="inline-flex" alignItems="center" justifyContent="center"
        bg={medal || 'transparent'} color={medal ? (i === 1 ? 'navy' : 'white') : 'ui.muted'}
        fontSize="0.8125rem" fontWeight="700" fontVariantNumeric="tabular-nums">{i}</Box>
      <Avatar src={person.avatar} color={active ? YELLOW : NAVY} />
      <Box flex="1" minW="0">
        <Text color="ui.text" fontSize="0.875rem" fontWeight={active ? '700' : '500'} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{person.name}</Text>
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
  return (
    <Box bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="forge" boxShadow="sm" p="5" w="full">
      <Flex align="flex-start" gap="4" mb="4">
        <Avatar src={person.avatar} size={56} />
        <Box flex="1" minW="0">
          <Flex align="baseline" justify="space-between" gap="3">
            <Text fontSize="1.15rem" fontWeight="800" color="ui.heading" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{person.name}</Text>
            <chakra.a href={`https://profiles.wordpress.org/${encodeURIComponent(person.slug || person.name)}/`} target="_blank" rel="noopener noreferrer"
              color="ui.primary" fontSize="0.8125rem" fontWeight="600" whiteSpace="nowrap" flex="none" _hover={{ textDecoration: 'underline' }}>Visit profile ↗</chakra.a>
          </Flex>
          <Flex align="baseline" gap="2" mt="1">
            <chakra.b fontSize="2rem" fontWeight="800" color="ui.heading" lineHeight="1" fontVariantNumeric="tabular-nums">{count}</chakra.b>
            <Text color="ui.muted" fontSize="0.875rem">contributions · {srcLabel}</Text>
          </Flex>
          <Text color="ui.muted" fontSize="0.8125rem" mt="1.5">{person.employer ? `Works at ${person.employer}` : 'Employer not listed on wp.org'}</Text>
        </Box>
      </Flex>
      <Stack gap="0" maxH="22rem" overflowY="auto" pr="1"
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
      <Box h="200px" w="full">
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
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const custom = periodVal === 'custom';

  function onPeriod(v) {
    setPeriodVal(v);
    const p = periods.find((x) => x.value === v);
    if (p && p.since) { setSince(p.since); setUntil(p.until); }
  }

  useEffect(() => {
    let live = true;
    (async () => {
      for (const [repo, set] of [['gutenberg', setGbBranches], ['core', setCoreBranches]]) {
        try {
          const { ok, data: b } = await fetchJSON('/api/contributors/branches?repo=' + repo);
          if (live && ok && b.branches && b.branches.length) set(b.branches);
        } catch { /* keep the trunk default */ }
      }
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
      else { setData(body); setSelected(body.report?.byContributor?.[0]?.name || null); }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [since, until, gbBranch, coreBranch]);

  useEffect(() => { setPage(0); }, [repoFilter, search, data]);

  const report = data && data.report;
  const q = search.trim().toLowerCase();
  const valueOf = (p) => (repoFilter === 'core' ? p.core : repoFilter === 'gutenberg' ? p.gutenberg : p.props);
  const people = useMemo(() => (!report ? [] : report.byContributor
    .filter((c) => valueOf(c) > 0)
    .filter((c) => !q || c.name.toLowerCase().includes(q))
    .sort((a, b) => valueOf(b) - valueOf(a))), [report, q, repoFilter]);
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

  return (
    <>
      <Box bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="forge" boxShadow="sm" px="6" py="6" mb="8">
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
      </Box>

      {error && <Box mb="4" color="ui.bad" fontSize="0.875rem">{error}</Box>}

      {loading ? <LoadingState /> : !report ? <EmptyState /> : (
        <>
          <SimpleGrid minChildWidth="10.5rem" gap="4" mb="6">
            <StatCard n={report.totals.contributors} label="Contributors" counted />
            <StatCard n={report.totals.coreCommits} label="Core changes" />
            <StatCard n={report.totals.gutenbergCommits} label="Gutenberg changes" />
            <StatCard n={co ? co.byCompany.length : report.totals.coreCommits + report.totals.gutenbergCommits} label={co ? 'Companies' : 'Total changes'} />
          </SimpleGrid>

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
            tabs={[{ value: 'contributors', label: 'Contributors' }, { value: 'companies', label: co ? `Companies (${co.byCompany.length})` : 'Companies' }]} />

          {tab === 'contributors' ? (
            <>
              <Flex justify="flex-end" gap="3" mb="4" wrap="wrap">
                <Segmented options={[{ value: 'all', label: 'All' }, { value: 'core', label: 'Core' }, { value: 'gutenberg', label: 'Gutenberg' }]} value={repoFilter} onChange={setRepoFilter} />
                <Box w="12rem"><TextInput value={search} placeholder="Filter by name…" onChange={(e) => setSearch(e.target.value)} /></Box>
              </Flex>
              {list.length ? (
                <Flex direction={{ base: 'column', xl: 'row' }} gap="8" align="flex-start" mb="4">
                  <Box flex="1 1 0" minW="0" w="full">
                    <Flex justify="center" mb="6"><Donut data={slices} total={report.totals.contributors} unit="people" selected={selPerson?.name} onSelect={setSelected} /></Flex>
                    <Stack gap="0">
                      {pageItems.map((p, i) => (
                        <RankRow key={p.name} i={page * PAGE + i + 1} person={p} value={valueOf(p)} max={listMax}
                          active={selPerson?.name === p.name} onClick={() => setSelected(p.name)} />
                      ))}
                    </Stack>
                    {totalPages > 1 && (
                      <Flex align="center" justify="center" gap="3" mt="5">
                        <chakra.button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                          px="3.5" py="1.5" borderRadius="forge" fontSize="0.8125rem" fontWeight="600" cursor="pointer" bg="ui.sunk" color="ui.text"
                          borderWidth="1px" borderColor="ui.border" _hover={{ borderColor: 'ui.primary' }} _disabled={{ opacity: 0.4, cursor: 'default' }}>Previous</chakra.button>
                        <Text color="ui.muted" fontSize="0.8125rem" fontVariantNumeric="tabular-nums">Page {page + 1} of {totalPages} · top {pool.length}</Text>
                        <chakra.button type="button" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                          px="3.5" py="1.5" borderRadius="forge" fontSize="0.8125rem" fontWeight="600" cursor="pointer" bg="ui.sunk" color="ui.text"
                          borderWidth="1px" borderColor="ui.border" _hover={{ borderColor: 'ui.primary' }} _disabled={{ opacity: 0.4, cursor: 'default' }}>Next</chakra.button>
                      </Flex>
                    )}
                  </Box>
                  <Box flex="1 1 0" minW="0" w="full"><Detail person={selPerson} repoFilter={repoFilter} /></Box>
                </Flex>
              ) : <Text color="ui.muted" fontSize="0.875rem" mb="6">No matching contributors.</Text>}
            </>
          ) : co && coList.length > 0 ? (
            <>
              <Text color="ui.muted" fontSize="0.8125rem" mb="4">
                Employer known for {co.coverage.peopleKnown} of {co.coverage.peopleTotal} people ({co.coverage.pct}%). Location is not published on wp.org profiles.
              </Text>
              <Flex gap="8" align="center" wrap="wrap" mb="4">
                <Donut data={coSlices} total={co.byCompany.length} unit="companies" />
                <Stack gap="0" flex="1 1 16rem" minW="0">
                  {coList.slice(0, 15).map((r, i) => (
                    <RankRow key={r.name} i={i + 1} person={{ name: r.name, avatar: companyLogo(r.name) }} value={r.value} max={coMax} />
                  ))}
                </Stack>
              </Flex>
            </>
          ) : <Text color="ui.muted" fontSize="0.875rem" mb="6">No company data for this window.</Text>}
        </>
      )}
    </>
  );
}
