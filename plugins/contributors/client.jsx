// Contributors — client side of the bundled UnleashWP core plugin. The shell
// mounts this default-exported component in <main>. It calls the plugin's own
// /api/contributors route and renders the leaderboard + company breakdown using
// the same StatCard / surface tokens the Changelog tool uses.
import { useState, useCallback } from 'react';
import { Box, Flex, HStack, SimpleGrid, Spinner, Text, chakra } from '@chakra-ui/react';
import { useCore, fetchJSON } from '../../src/client/core.jsx';
import { Button, TextInput, Checkbox } from '../../src/client/ui';

// One input → the right query param: "2025-Q4", "2025-10", or "a..b" range.
function periodParams(input) {
  const v = (input || '').trim();
  if (/^\d{4}[-\s]?q[1-4]$/i.test(v)) return { quarter: v };
  if (/^\d{4}-\d{2}$/.test(v)) return { month: v };
  const m = v.match(/^(\d{4}-\d{2}-\d{2})\s*(?:\.\.|to)\s*(\d{4}-\d{2}-\d{2})$/i);
  if (m) return { since: m[1], until: m[2] };
  return null;
}

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

function Row({ rank, label, sub, value, max, color }) {
  const pct = Math.max(2, Math.round((value / (max || 1)) * 100));
  return (
    <Flex align="center" gap="3" py="1.5" borderBottomWidth="1px" borderColor="ui.border">
      <Text w="2rem" textAlign="right" color="ui.muted" fontVariantNumeric="tabular-nums" fontSize="0.8125rem">{rank}</Text>
      <Box flex="0 0 11rem" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
        <Text as="span" color="ui.text" title={label}>{label}</Text>
      </Box>
      <Box flex="1"><Box h="10px" borderRadius="sm" bg={color} w={pct + '%'} minW="3px" /></Box>
      {sub && <Text w="4.5rem" textAlign="right" color="ui.muted" fontSize="0.75rem">{sub}</Text>}
      <Text w="3rem" textAlign="right" fontWeight="700" color="ui.heading" fontVariantNumeric="tabular-nums">{value}</Text>
    </Flex>
  );
}

export default function Contributors() {
  const core = useCore() || {};
  const [period, setPeriod] = useState('2025-10');
  const [withCompanies, setWithCompanies] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const run = useCallback(async () => {
    const params = periodParams(period);
    if (!params) { setError('Use a period like 2025-Q4, 2025-10, or 2025-10-01..2025-10-31.'); return; }
    setError(''); setLoading(true); setData(null);
    const qs = new URLSearchParams({ ...params, ...(withCompanies ? { companies: 'true' } : {}) });
    try {
      const { ok, data: body } = await fetchJSON('/api/contributors?' + qs.toString());
      if (!ok) setError(body.error || 'Request failed'); else setData(body);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [period, withCompanies]);

  const report = data && data.report;
  const lead = report ? report.byContributor.slice(0, 25) : [];
  const leadMax = lead.reduce((m, r) => Math.max(m, r.props), 0);
  const co = report && report.companies;
  const coMax = co ? co.byCompany.reduce((m, r) => Math.max(m, r.contributions), 0) : 0;

  return (
    <Box p="6" maxW="900px" mx="auto">
      <Flex gap="3" align="center" wrap="wrap" mb="6">
        <Box w="16rem">
          <TextInput value={period} placeholder="2025-Q4 · 2025-10 · a..b"
            onChange={(e) => setPeriod(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') run(); }} />
        </Box>
        <HStack gap="2">
          <Checkbox checked={withCompanies} onChange={(e) => setWithCompanies(e.target.checked)} />
          <Text color="ui.text" fontSize="0.875rem">Company investment (slower)</Text>
        </HStack>
        <Button variant="primary" onClick={run}>Run</Button>
        {loading && <Spinner size="sm" color="ui.primary" />}
      </Flex>

      {error && <Box mb="4" color="ui.bad" fontSize="0.875rem">{error}</Box>}

      {report && (
        <>
          <SimpleGrid columns={{ base: 2, md: 4 }} gap="4" mb="8">
            <StatCard n={report.totals.contributors} label="Contributors" counted />
            <StatCard n={report.totals.coreCommits} label="Core changes" />
            <StatCard n={report.totals.gutenbergCommits} label="Gutenberg changes" />
            <StatCard n={co ? co.byCompany.length : report.window.label} label={co ? 'Companies' : 'Period'} />
          </SimpleGrid>

          <Text fontSize="1.05rem" fontWeight="700" color="ui.heading" mb="2">Leaderboard — {report.window.label}</Text>
          <Box mb={co ? '8' : '4'}>
            {lead.map((r, i) => (
              <Row key={r.name} rank={i + 1} label={r.name} sub={r.source} value={r.props} max={leadMax} color={SRC_COLOR[r.source] || SRC_COLOR.both} />
            ))}
          </Box>

          {co && (
            <Box>
              <Text fontSize="1.05rem" fontWeight="700" color="ui.heading" mb="1">Which company invested most</Text>
              <Text color="ui.muted" fontSize="0.8125rem" mb="3">
                Employer known for {co.coverage.peopleKnown}/{co.coverage.peopleTotal} ({co.coverage.pct}%). Location/geography is not published on wp.org profiles, so it is not shown.
              </Text>
              {co.byCompany.slice(0, 15).map((r, i) => (
                <Row key={r.company} rank={i + 1} label={r.company} sub={`${r.people} ppl`} value={r.contributions} max={coMax} color={SRC_COLOR.company} />
              ))}
            </Box>
          )}

          {data.markdown && (
            <Button mt="6" onClick={() => { try { navigator.clipboard.writeText(data.markdown); core.toast && core.toast('Markdown copied', 'success'); } catch { /* ignore */ } }}>Copy Markdown</Button>
          )}
        </>
      )}
    </Box>
  );
}
