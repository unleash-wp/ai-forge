// Contributors — client side of the bundled UnleashWP core plugin. The shell
// mounts this default-exported component in <main>. Period is a quarter / annual
// / custom picker; results render with Chakra UI Charts (Recharts) in a single
// calm colour, with contributor names linked to their wp.org profiles.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Flex, HStack, SimpleGrid, Spinner, Stack, Skeleton, Text, chakra, Checkbox as CChk } from '@chakra-ui/react';
import { Chart, useChart } from '@chakra-ui/charts';
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useCore, fetchJSON } from '../../src/client/core.jsx';
import { Button, TextInput, Select, DateRangePicker } from '../../src/client/ui';

const BAR = '#3858e9';           // one calm accent for the bars
const pad = (n) => String(n).padStart(2, '0');

// --- period options: recent quarters + annual reports + a custom range ---
function quarterWindow(year, q) {
  const sm = (q - 1) * 3 + 1;
  const em = sm + 2;
  const last = new Date(Date.UTC(year, em, 0)).getUTCDate();
  return { since: `${year}-${pad(sm)}-01`, until: `${year}-${pad(em)}-${pad(last)}` };
}
function buildPeriods(now) {
  const y = now.getUTCFullYear();
  const curQ = Math.floor(now.getUTCMonth() / 3) + 1;
  const out = [];
  let qy = y, qq = curQ;
  for (let i = 0; i < 8; i++) {
    out.push({ value: `q-${qy}-${qq}`, label: `Q${qq} ${qy}${qy === y && qq === curQ ? ' · in progress' : ''}`, ...quarterWindow(qy, qq) });
    qq -= 1; if (qq === 0) { qq = 4; qy -= 1; }
  }
  for (let yr = y; yr >= y - 3; yr -= 1) {
    out.push({ value: `y-${yr}`, label: `${yr} · annual report`, since: `${yr}-01-01`, until: `${yr}-12-31` });
  }
  out.push({ value: 'custom', label: 'Custom range…' });
  return out;
}

// A labelled field wrapper, matching the DateRangePicker's uppercase label.
function Field({ label, children, basis = '1 1 10rem' }) {
  return (
    <Box display="flex" flexDir="column" gap="1.5" flex={basis} minW="9rem">
      <Text as="span" fontSize="0.7813rem" fontWeight="600" letterSpacing=".04em" textTransform="uppercase" color="ui.muted">{label}</Text>
      {children}
    </Box>
  );
}

// Same card the Changelog tool uses; `counted` adds the yellow top inset.
function StatCard({ n, label, counted }) {
  return (
    <Box bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="forge" px="5" py="4" boxShadow="sm"
      css={counted ? { boxShadow: 'inset 0 2.5px 0 var(--chakra-colors-yellow), var(--chakra-shadows-sm)' } : undefined}>
      <chakra.b display="block" fontSize="clamp(1.5rem, 1.2rem + 1vw, 2rem)" fontWeight="800" color="ui.heading" lineHeight="1.1" letterSpacing="-.02em" fontVariantNumeric="tabular-nums" whiteSpace="nowrap">{n}</chakra.b>
      <Text display="block" color="ui.muted" fontSize="0.8125rem" mt="1" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">{label}</Text>
    </Box>
  );
}

// Y-axis tick that links a contributor name to their wp.org profile.
function LinkedTick({ x, y, payload }) {
  const name = payload.value;
  return (
    <a href={`https://profiles.wordpress.org/${encodeURIComponent(name)}/`} target="_blank" rel="noopener noreferrer">
      <text x={x - 8} y={y} dy={4} textAnchor="end" fontSize={12} fill="var(--chakra-colors-ui-primary)"
        style={{ cursor: 'pointer', textDecoration: 'underline' }}>{name}</text>
    </a>
  );
}
function PlainTick({ x, y, payload }) {
  return <text x={x - 8} y={y} dy={4} textAnchor="end" fontSize={12} fill="var(--chakra-colors-ui-text)">{payload.value}</text>;
}

// Horizontal bar chart via Chakra UI Charts, one colour, optional linked ticks.
function HBar({ rows, tick }) {
  const chart = useChart({ data: rows });
  const h = rows.length * 30 + 16;
  return (
    <Chart.Root chart={chart} w="full">
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={chart.data} layout="vertical" margin={{ left: 8, right: 40, top: 2, bottom: 2 }} barSize={15} barCategoryGap={7}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} interval={0} tick={tick} />
          <Tooltip cursor={{ fill: 'rgba(128,128,128,0.08)' }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false} fill={BAR}
            label={{ position: 'right', fontSize: 11, fill: 'var(--chakra-colors-ui-muted)' }} />
        </BarChart>
      </ResponsiveContainer>
    </Chart.Root>
  );
}

// The waiting frame, mirroring the Changelog tool's skeleton.
function ResultsSkeleton() {
  return (
    <>
      <SimpleGrid columns={{ base: 2, md: 4 }} gap="4" mb="6">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} h="4.75rem" borderRadius="forge" />)}
      </SimpleGrid>
      <Skeleton h="2.5rem" w="16rem" borderRadius="forge" mb="5" />
      <Stack gap="2.5">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} h="1.375rem" borderRadius="sm" />)}</Stack>
    </>
  );
}

export default function Contributors() {
  const core = useCore() || {};
  const periods = useMemo(() => buildPeriods(new Date()), []);
  const [periodVal, setPeriodVal] = useState(periods[1].value); // latest COMPLETE quarter
  const [since, setSince] = useState(periods[1].since);
  const [until, setUntil] = useState(periods[1].until);
  const [gbBranch, setGbBranch] = useState('trunk');
  const [coreBranch, setCoreBranch] = useState('trunk');
  const [gbBranches, setGbBranches] = useState(['trunk']);
  const [coreBranches, setCoreBranches] = useState(['trunk']);
  const [withCompanies, setWithCompanies] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const custom = periodVal === 'custom';

  function onPeriod(v) {
    setPeriodVal(v);
    const p = periods.find((x) => x.value === v);
    if (p && p.since) { setSince(p.since); setUntil(p.until); }
  }

  // Populate the branch pickers once (trunk + wp/x.y + …).
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
    setError(''); setLoading(true); setData(null);
    const qs = new URLSearchParams({ since, until, gbBranch, coreBranch, ...(withCompanies ? { companies: 'true' } : {}) });
    try {
      const { ok, data: body } = await fetchJSON('/api/contributors?' + qs.toString());
      if (!ok) setError(body.error || 'Request failed'); else setData(body);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [since, until, gbBranch, coreBranch, withCompanies]);

  const report = data && data.report;
  const q = search.trim().toLowerCase();
  const leadRows = useMemo(() => (!report ? [] : report.byContributor
    .filter((c) => !q || c.name.toLowerCase().includes(q)).slice(0, 20)
    .map((c) => ({ name: c.name, value: c.props }))), [report, q]);
  const co = report && report.companies;
  const coRows = useMemo(() => (!co ? [] : co.byCompany
    .filter((c) => !q || c.company.toLowerCase().includes(q)).slice(0, 15)
    .map((c) => ({ name: c.company, value: c.contributions }))), [co, q]);

  return (
    <>
      <Box bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="forge" boxShadow="sm" px="6" py="6" mb="8">
        <Flex gap={{ base: '4', lg: '6' }} align="flex-end" wrap="wrap">
          <Field label="Period">
            <Select block searchable ariaLabel="Period" value={periodVal} onChange={onPeriod}
              options={periods.map((p) => ({ value: p.value, label: p.label }))} placeholder="Select" />
          </Field>
          {custom && (
            <DateRangePicker since={since} until={until} onChange={(a, b) => { setSince(a); setUntil(b); }} />
          )}
          <Field label="Gutenberg branch">
            <Select block searchable ariaLabel="Gutenberg branch" value={gbBranch} onChange={setGbBranch}
              options={gbBranches.map((b) => ({ value: b, label: b }))} placeholder="trunk" />
          </Field>
          <Field label="Core branch">
            <Select block searchable ariaLabel="Core branch" value={coreBranch} onChange={setCoreBranch}
              options={coreBranches.map((b) => ({ value: b, label: b }))} placeholder="trunk" />
          </Field>
        </Flex>
        <Flex align={{ base: 'stretch', lg: 'center' }} justify="space-between" gap="4" mt="6" pt="4"
          borderTop="1px solid" borderColor="ui.border" direction={{ base: 'column', lg: 'row' }}>
          <CChk.Root checked={withCompanies} colorPalette="brand" cursor="pointer"
            onCheckedChange={(d) => setWithCompanies(d.checked === true)}>
            <CChk.HiddenInput />
            <CChk.Control cursor="pointer" _checked={{ bg: 'navy', borderColor: 'navy', color: 'white' }} />
            <CChk.Label fontSize="0.875rem" fontWeight="500" cursor="pointer" color="ui.text">Company investment (slower)</CChk.Label>
          </CChk.Root>
          <HStack gap="4">
            {loading && <Spinner size="sm" color="navy" />}
            <Button variant="primary" onClick={run} disabled={loading} px="7.5" fontWeight="700">Run</Button>
          </HStack>
        </Flex>
      </Box>

      {error && <Box mb="4" color="ui.bad" fontSize="0.875rem">{error}</Box>}

      {loading ? <ResultsSkeleton /> : report && (
        <>
          <SimpleGrid minChildWidth="10.5rem" gap="4" mb="6">
            <StatCard n={report.totals.contributors} label="Contributors" counted />
            <StatCard n={report.totals.coreCommits} label="Core changes" />
            <StatCard n={report.totals.gutenbergCommits} label="Gutenberg changes" />
            <StatCard n={co ? co.byCompany.length : report.totals.coreCommits + report.totals.gutenbergCommits} label={co ? 'Companies' : 'Total changes'} />
          </SimpleGrid>

          <Box w="16rem" mb="5">
            <TextInput value={search} placeholder="Filter by name…" onChange={(e) => setSearch(e.target.value)} />
          </Box>

          <Text fontSize="1.05rem" fontWeight="700" color="ui.heading" mb="3">Leaderboard</Text>
          {leadRows.length ? <HBar rows={leadRows} tick={<LinkedTick />} />
            : <Text color="ui.muted" fontSize="0.875rem">No matching contributors.</Text>}

          {co && (
            <Box mt="8">
              <Text fontSize="1.05rem" fontWeight="700" color="ui.heading" mb="1">Which company invested most</Text>
              <Text color="ui.muted" fontSize="0.8125rem" mb="3">
                Employer known for {co.coverage.peopleKnown}/{co.coverage.peopleTotal} ({co.coverage.pct}%). Location/geography is not published on wp.org profiles, so it is not shown.
              </Text>
              {coRows.length ? <HBar rows={coRows} tick={<PlainTick />} />
                : <Text color="ui.muted" fontSize="0.875rem">No matching companies.</Text>}
            </Box>
          )}

          {data.markdown && (
            <Button mt="8" onClick={() => { try { navigator.clipboard.writeText(data.markdown); core.toast && core.toast('Markdown copied', 'success'); } catch { /* ignore */ } }}>Copy Markdown</Button>
          )}
        </>
      )}
    </>
  );
}
