// Contributors — client side of the bundled UnleashWP core plugin. Period is a
// quarter / annual / custom picker. Results show a donut of the top contributors
// (UnleashWP navy + yellow), a selectable ranked list, and a detail panel of what
// the selected person actually shipped, plus a company-investment breakdown.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Flex, HStack, SimpleGrid, Spinner, Stack, Skeleton, Text, chakra, Checkbox as CChk } from '@chakra-ui/react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useCore, fetchJSON } from '../../src/client/core.jsx';
import { Button, TextInput, Select, DateRangePicker } from '../../src/client/ui';

// UnleashWP brand: navy ramp + yellow accent. The selected slice turns yellow.
const NAVY = '#203159';
const YELLOW = '#fcbe00';
const RAMP = ['#203159', '#2a3f6f', '#3c4e7d', '#4a5c8c', '#5d6f9f', '#7385b0', '#8f9dc4', '#aab6d6'];
const OTHERS = '#c3cadb';
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

// Group a ranked [{name,value}] list into the top N slices + an "Others" slice.
function toSlices(rows, top) {
  const head = rows.slice(0, top);
  const rest = rows.slice(top).reduce((s, r) => s + r.value, 0);
  return rest > 0 ? [...head, { name: 'Others', value: rest, others: true }] : head;
}
const sliceColor = (row, i, selected) => (row.name === selected ? YELLOW : row.others ? OTHERS : RAMP[i % RAMP.length]);

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

// Donut with the total in the middle. `data` = [{name,value,others?}].
function Donut({ data, total, unit, selected, onSelect }) {
  return (
    <Box position="relative" w="200px" h="200px" flex="none">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={64} outerRadius={96} paddingAngle={1.5} stroke="none"
            isAnimationActive={false} onClick={(d) => onSelect && d && !d.others && onSelect(d.name)}>
            {data.map((d, i) => <Cell key={i} fill={sliceColor(d, i, selected)} cursor={d.others ? 'default' : 'pointer'} />)}
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

// One selectable row in the ranked list.
function RankRow({ i, color, name, value, max, active, onClick }) {
  return (
    <Flex as="button" type="button" onClick={onClick} align="center" gap="3" w="full" textAlign="left"
      px="2.5" py="2" borderRadius="forge" cursor="pointer" bg={active ? 'ui.sunk' : 'transparent'}
      borderWidth="1px" borderColor={active ? 'ui.border' : 'transparent'} _hover={{ bg: 'ui.sunk' }} transition="background .12s">
      <Box w="9px" h="9px" borderRadius="full" bg={color} flex="none" />
      <Text w="1.5rem" textAlign="right" color="ui.muted" fontSize="0.8125rem" fontVariantNumeric="tabular-nums" flex="none">{i}</Text>
      <Text flex="1" minW="0" color="ui.text" fontSize="0.875rem" fontWeight={active ? '700' : '500'} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{name}</Text>
      <Box flex="0 0 3.5rem" h="7px" borderRadius="full" bg="ui.sunk" overflow="hidden">
        <Box h="full" borderRadius="full" bg={active ? YELLOW : NAVY} w={`${Math.max(6, Math.round((value / (max || 1)) * 100))}%`} />
      </Box>
      <Text w="2.25rem" textAlign="right" color="ui.heading" fontSize="0.875rem" fontWeight="700" fontVariantNumeric="tabular-nums" flex="none">{value}</Text>
    </Flex>
  );
}

const RepoTag = ({ repo }) => (
  <Box as="span" flex="none" px="1.5" py="0.5" borderRadius="sm" fontSize="0.625rem" fontWeight="700" letterSpacing=".02em"
    textTransform="uppercase" bg={repo === 'core' ? 'rgba(32,49,89,.10)' : 'rgba(114,127,159,.16)'}
    color={repo === 'core' ? 'ui.primary' : 'ui.muted'} _dark={{ bg: repo === 'core' ? 'rgba(124,147,255,.16)' : 'rgba(148,161,189,.16)' }}>
    {repo === 'core' ? 'Core' : 'GB'}
  </Box>
);

// Detail panel: what the selected contributor shipped.
function Detail({ person }) {
  if (!person) return null;
  return (
    <Box bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="forge" boxShadow="sm" p="5" w="full">
      <Flex align="baseline" justify="space-between" gap="3" mb="0.5">
        <Text fontSize="1.05rem" fontWeight="700" color="ui.heading">{person.name}</Text>
        <chakra.a href={`https://profiles.wordpress.org/${encodeURIComponent(person.name)}/`} target="_blank" rel="noopener noreferrer"
          color="ui.primary" fontSize="0.8125rem" fontWeight="600" whiteSpace="nowrap" _hover={{ textDecoration: 'underline' }}>profile ↗</chakra.a>
      </Flex>
      <Text color="ui.muted" fontSize="0.8125rem" mb="3">{person.props} contributions · {person.source === 'both' ? 'Core + Gutenberg' : person.source === 'core' ? 'Core' : 'Gutenberg'}</Text>
      <Stack gap="0" maxH="22rem" overflowY="auto" pr="1"
        css={{ '&::-webkit-scrollbar': { width: '6px' }, '&::-webkit-scrollbar-thumb': { background: 'var(--chakra-colors-ui-border)', borderRadius: '3px' } }}>
        {(person.items || []).map((it, i) => (
          <chakra.a key={i} href={it.url} target="_blank" rel="noopener noreferrer"
            display="flex" alignItems="baseline" gap="2.5" py="2" borderTopWidth={i ? '1px' : '0'} borderColor="ui.border"
            _hover={{ bg: 'ui.sunk' }} borderRadius="sm" px="1" mx="-1">
            <RepoTag repo={it.repo} />
            <Text flex="1" color="ui.text" fontSize="0.8125rem" lineHeight="1.4">{it.subject}</Text>
            <Text color="ui.muted" fontSize="0.75rem" fontVariantNumeric="tabular-nums" whiteSpace="nowrap" flex="none">{it.ref}</Text>
          </chakra.a>
        ))}
        {!person.items?.length && <Text color="ui.muted" fontSize="0.8125rem" py="2">No itemised changes in this window.</Text>}
      </Stack>
    </Box>
  );
}

function ResultsSkeleton() {
  return (
    <>
      <SimpleGrid minChildWidth="10.5rem" gap="4" mb="6">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h="4.75rem" borderRadius="forge" />)}</SimpleGrid>
      <Flex gap="6" wrap="wrap">
        <Skeleton w="200px" h="200px" borderRadius="full" />
        <Stack flex="1 1 20rem" gap="2.5">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} h="1.75rem" borderRadius="forge" />)}</Stack>
        <Skeleton flex="1 1 20rem" h="18rem" borderRadius="forge" />
      </Flex>
    </>
  );
}

export default function Contributors() {
  const core = useCore() || {};
  const periods = useMemo(() => buildPeriods(new Date()), []);
  const [periodVal, setPeriodVal] = useState(periods[1].value);
  const [since, setSince] = useState(periods[1].since);
  const [until, setUntil] = useState(periods[1].until);
  const [gbBranch, setGbBranch] = useState('trunk');
  const [coreBranch, setCoreBranch] = useState('trunk');
  const [gbBranches, setGbBranches] = useState(['trunk']);
  const [coreBranches, setCoreBranches] = useState(['trunk']);
  const [withCompanies, setWithCompanies] = useState(false);
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
    const qs = new URLSearchParams({ since, until, gbBranch, coreBranch, ...(withCompanies ? { companies: 'true' } : {}) });
    try {
      const { ok, data: body } = await fetchJSON('/api/contributors?' + qs.toString());
      if (!ok) setError(body.error || 'Request failed');
      else { setData(body); setSelected(body.report?.byContributor?.[0]?.name || null); }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [since, until, gbBranch, coreBranch, withCompanies]);

  const report = data && data.report;
  const q = search.trim().toLowerCase();
  const people = useMemo(() => (!report ? [] : report.byContributor.filter((c) => !q || c.name.toLowerCase().includes(q))), [report, q]);
  const list = useMemo(() => people.slice(0, 20).map((c) => ({ name: c.name, value: c.props })), [people]);
  const slices = useMemo(() => toSlices(list, 8), [list]);
  const listMax = list.length ? list[0].value : 1;
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
        </Flex>
        <Flex align={{ base: 'stretch', lg: 'center' }} justify="space-between" gap="4" mt="6" pt="4"
          borderTop="1px solid" borderColor="ui.border" direction={{ base: 'column', lg: 'row' }}>
          <CChk.Root checked={withCompanies} colorPalette="brand" cursor="pointer" onCheckedChange={(d) => setWithCompanies(d.checked === true)}>
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

          <Box w="18rem" maxW="full" mb="6">
            <TextInput value={search} placeholder="Filter by name…" onChange={(e) => setSearch(e.target.value)} />
          </Box>

          <Text fontSize="1.05rem" fontWeight="700" color="ui.heading" mb="4">Top contributors</Text>
          {list.length ? (
            <Flex direction={{ base: 'column', xl: 'row' }} gap="8" align="flex-start" mb={co ? '10' : '2'}>
              <Box flex="1 1 0" minW="0" w="full">
                <Flex justify="center" mb="6"><Donut data={slices} total={report.totals.contributors} unit="people" selected={selPerson?.name} onSelect={setSelected} /></Flex>
                <Stack gap="0">
                  {list.map((r, i) => (
                    <RankRow key={r.name} i={i + 1} color={i < 8 ? RAMP[i % RAMP.length] : OTHERS} name={r.name} value={r.value} max={listMax}
                      active={selPerson?.name === r.name} onClick={() => setSelected(r.name)} />
                  ))}
                </Stack>
              </Box>
              <Box flex="1 1 0" minW="0" w="full" position={{ xl: 'sticky' }} top={{ xl: '1rem' }}><Detail person={selPerson} /></Box>
            </Flex>
          ) : <Text color="ui.muted" fontSize="0.875rem" mb="6">No matching contributors.</Text>}

          {co && (
            <Box>
              <Text fontSize="1.05rem" fontWeight="700" color="ui.heading" mb="1">Which company invested most</Text>
              <Text color="ui.muted" fontSize="0.8125rem" mb="4">
                Employer known for {co.coverage.peopleKnown}/{co.coverage.peopleTotal} ({co.coverage.pct}%). Location/geography is not published on wp.org profiles.
              </Text>
              {coList.length ? (
                <Flex gap="6" align="center" wrap="wrap">
                  <Donut data={coSlices} total={co.byCompany.length} unit="companies" />
                  <Stack gap="0" flex="1 1 14rem" minW="0">
                    {coList.slice(0, 12).map((r, i) => (
                      <RankRow key={r.name} i={i + 1} color={i < 8 ? RAMP[i % RAMP.length] : OTHERS} name={r.name} value={r.value} max={coMax} />
                    ))}
                  </Stack>
                </Flex>
              ) : <Text color="ui.muted" fontSize="0.875rem">No matching companies.</Text>}
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
