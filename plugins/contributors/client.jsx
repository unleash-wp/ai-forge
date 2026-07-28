// Contributors — client side of the bundled UnleashWP core plugin. The shell
// mounts this default-exported component in <main>. It reuses the shell's shared
// DateRangePicker, renders the leaderboard + company breakdown with Chakra UI
// Charts (Recharts), and matches the Changelog tool's StatCard / surface tokens.
import { useState, useCallback, useMemo } from 'react';
import { Box, Flex, HStack, SimpleGrid, Spinner, Text, chakra } from '@chakra-ui/react';
import { Chart, useChart } from '@chakra-ui/charts';
import { Bar, BarChart, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useCore, fetchJSON } from '../../src/client/core.jsx';
import { Button, TextInput, Checkbox, DateRangePicker } from '../../src/client/ui';

// Bar colour by where the credit comes from (matches the CLI/SVG charts).
const SRC_COLOR = { core: '#3858e9', gutenberg: '#1a9d6b', both: '#7c3aed', company: '#7c3aed' };

// Same card the Changelog tool uses; `counted` adds the yellow top inset.
function StatCard({ n, label, counted }) {
  return (
    <Box bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="forge" px="5" py="4" boxShadow="sm"
      css={counted ? { boxShadow: 'inset 0 2.5px 0 var(--chakra-colors-yellow), var(--chakra-shadows-sm)' } : undefined}>
      <chakra.b display="block" fontSize="clamp(1.75rem, 1.5rem + 1vw, 2.375rem)" fontWeight="800" color="ui.heading" lineHeight="1.05" letterSpacing="-.02em" fontVariantNumeric="tabular-nums">{n}</chakra.b>
      <Text display="block" color="ui.muted" fontSize="0.8125rem" mt="0.5">{label}</Text>
    </Box>
  );
}

// Horizontal bar chart via Chakra UI Charts. `rows` = [{ name, value, fill }].
function HBar({ rows }) {
  const chart = useChart({ data: rows });
  const h = rows.length * 28 + 16;
  return (
    <Chart.Root chart={chart} w="full">
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={chart.data} layout="vertical" margin={{ left: 8, right: 34, top: 2, bottom: 2 }} barSize={14} barCategoryGap={6}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false}
            tick={{ fontSize: 12, fill: 'var(--chakra-colors-ui-text)' }} />
          <Tooltip cursor={{ fill: 'rgba(128,128,128,0.10)' }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}
            label={{ position: 'right', fontSize: 11, fill: 'var(--chakra-colors-ui-muted)' }}>
            {chart.data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Chart.Root>
  );
}

export default function Contributors() {
  const core = useCore() || {};
  const [since, setSince] = useState('2025-10-01');
  const [until, setUntil] = useState('2025-10-31');
  const [withCompanies, setWithCompanies] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const run = useCallback(async () => {
    if (!since || !until) { setError('Pick a date range first.'); return; }
    setError(''); setLoading(true); setData(null);
    const qs = new URLSearchParams({ since, until, ...(withCompanies ? { companies: 'true' } : {}) });
    try {
      const { ok, data: body } = await fetchJSON('/api/contributors?' + qs.toString());
      if (!ok) setError(body.error || 'Request failed'); else setData(body);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [since, until, withCompanies]);

  const report = data && data.report;
  const q = search.trim().toLowerCase();
  const leadRows = useMemo(() => (!report ? [] : report.byContributor
    .filter((c) => !q || c.name.toLowerCase().includes(q)).slice(0, 20)
    .map((c) => ({ name: c.name, value: c.props, fill: SRC_COLOR[c.source] || SRC_COLOR.both }))), [report, q]);
  const co = report && report.companies;
  const coRows = useMemo(() => (!co ? [] : co.byCompany
    .filter((c) => !q || c.company.toLowerCase().includes(q)).slice(0, 15)
    .map((c) => ({ name: c.company, value: c.contributions, fill: SRC_COLOR.company }))), [co, q]);

  return (
    <>
      <Box bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="forge" boxShadow="sm" px="6" py="6" mb="8">
        <Flex gap={{ base: '4', lg: '6' }} align="flex-end" wrap="wrap">
          <DateRangePicker since={since} until={until} onChange={(a, b) => { setSince(a); setUntil(b); }} />
          <HStack gap="2" pb="2.5">
            <Checkbox checked={withCompanies} onChange={(e) => setWithCompanies(e.target.checked)} />
            <Text color="ui.text" fontSize="0.875rem">Company investment (slower)</Text>
          </HStack>
          <Box pb="0.5" ml={{ lg: 'auto' }}><Button variant="primary" onClick={run} px="7.5" fontWeight="700">Run</Button></Box>
          {loading && <Spinner size="sm" color="navy" mb="2.5" />}
        </Flex>
      </Box>

      {error && <Box mb="4" color="ui.bad" fontSize="0.875rem">{error}</Box>}

      {report && (
        <>
          <SimpleGrid columns={{ base: 2, md: 4 }} gap="4" mb="6">
            <StatCard n={report.totals.contributors} label="Contributors" counted />
            <StatCard n={report.totals.coreCommits} label="Core changes" />
            <StatCard n={report.totals.gutenbergCommits} label="Gutenberg changes" />
            <StatCard n={co ? co.byCompany.length : report.totals.coreCommits + report.totals.gutenbergCommits} label={co ? 'Companies' : 'Total changes'} />
          </SimpleGrid>

          <Box w="16rem" mb="5">
            <TextInput value={search} placeholder="Filter by name…" onChange={(e) => setSearch(e.target.value)} />
          </Box>

          <Text fontSize="1.05rem" fontWeight="700" color="ui.heading" mb="3">Leaderboard</Text>
          {leadRows.length ? <HBar rows={leadRows} /> : <Text color="ui.muted" fontSize="0.875rem">No matching contributors.</Text>}

          {co && (
            <Box mt="8">
              <Text fontSize="1.05rem" fontWeight="700" color="ui.heading" mb="1">Which company invested most</Text>
              <Text color="ui.muted" fontSize="0.8125rem" mb="3">
                Employer known for {co.coverage.peopleKnown}/{co.coverage.peopleTotal} ({co.coverage.pct}%). Location/geography is not published on wp.org profiles, so it is not shown.
              </Text>
              {coRows.length ? <HBar rows={coRows} /> : <Text color="ui.muted" fontSize="0.875rem">No matching companies.</Text>}
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
