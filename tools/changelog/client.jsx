// Changelog Generator - client side of the first UnleashWP Forge tool plugin.
// Default-exports a React component that the shell mounts in <main>. It receives
// the core services (toast, openSetup) via the CoreContext. UI is Chakra UI v3;
// the changelog body stays an HTML string (React can't mount components inside
// dangerouslySetInnerHTML) styled by the `changelogCss` block below.
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Badge, Box, Button, Checkbox as CChk, Flex, Grid, Heading, HStack, Link, SimpleGrid, Skeleton, Spinner, Stack, Tabs, Text, chakra } from '@chakra-ui/react';
import { useCore } from '../../src/client/core.jsx';
import { useT, __ } from '../../src/client/i18n.jsx';
import { Button as UButton, Select, Checkbox, TextInput } from '../../src/client/ui'; // eslint-disable-line no-unused-vars
import { ArrowLeft, ArrowRight, CalendarIcon } from '../../src/client/icons.jsx';

const GB = 'https://github.com/WordPress/gutenberg';
const TRAC = 'https://core.trac.wordpress.org';
const CORE_GH = 'https://github.com/WordPress/wordpress-develop';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const codefmt = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

// Contributor hygiene: strip any leading @ so names are clean by default (the
// "Add @" toggle re-adds it), and drop automation accounts so props credit only
// real people.
const cleanName = (n) => String(n).replace(/^@+/, '').trim();
const isBot = (n) => /\[bot\]|(^|[^a-z])bot([^a-z]|$)|dependabot|renovate|greenkeeper|codecov|imgbot/i.test(String(n));

function svgIc(inner) { return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>'; }
const IC = {
  md: svgIc('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
  down: svgIc('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
  link: svgIc('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
  clip: svgIc('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  table: svgIc('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>'),
  ext: svgIc('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'),
};
function Ic({ html }) { return <chakra.span display="contents" dangerouslySetInnerHTML={{ __html: html }} />; }

function pad(n) { return (n < 10 ? '0' : '') + n; }
function isoD(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function fmtDay(isoStr) { const p = isoStr.split('-'); return __(MON[(+p[1]) - 1]) + ' ' + (+p[2]); }
function fmtRange(a, b) {
  const ya = a.split('-')[0], yb = b.split('-')[0];
  return ya === yb ? fmtDay(a) + __(' to ') + fmtDay(b) + ', ' + ya
                   : fmtDay(a) + ', ' + ya + __(' to ') + fmtDay(b) + ', ' + yb;
}

function uniq(arr) { const seen = {}, out = []; arr.forEach((x) => { if (!seen[x]) { seen[x] = 1; out.push(x); } }); return out; }
function sortGroups(obj, uncatLast) {
  return Object.keys(obj).map((k) => [k, obj[k]]).sort((a, b) => {
    if (uncatLast) { if (a[0] === 'Uncategorized') return 1; if (b[0] === 'Uncategorized') return -1; }
    return b[1].length - a[1].length;
  });
}
function groupHeadHtml(label, url, who) {
  const inner = url ? '<a class="cl-link" href="' + esc(url) + '" target="_blank" rel="noopener">' + label + IC.ext + '</a>' : label;
  return '<h2 class="cl-title">' + inner + ' <span class="cl-byline">(' + esc(who) + ')</span></h2>';
}
function gbItem(c) {
  const ref = c.pr
    ? '<a class="cl-ref" href="' + GB + '/pull/' + c.pr + '" target="_blank" rel="noopener">#' + c.pr + '</a>'
    : (c.sha ? '<a class="cl-ref" href="' + GB + '/commit/' + c.sha + '" target="_blank" rel="noopener">' + esc(c.shortSha) + '</a>' : '');
  return '<li>' + (ref ? ref + ' ' : '') + codefmt(c.subject) + ' <span class="cl-byline">by ' + esc(c.author) + '</span></li>';
}
function gbGroup(cat, items) { return '<h3 class="cl-sub">' + esc(cat) + ' <span class="cl-count">(' + items.length + ')</span></h3><ul class="cl-list">' + items.map(gbItem).join('') + '</ul>'; }
function coreItem(c) {
  const ref = c.changeset
    ? '<a class="cl-ref" href="' + TRAC + '/changeset/' + c.changeset + '" target="_blank" rel="noopener">r' + c.changeset + '</a>'
    : (c.sha ? '<a class="cl-ref" href="' + CORE_GH + '/commit/' + c.sha + '" target="_blank" rel="noopener">' + esc(c.shortSha) + '</a>' : esc(c.shortSha));
  const tix = (c.tickets || []).map((n) => '<a class="cl-ref" href="' + TRAC + '/ticket/' + n + '" target="_blank" rel="noopener">#' + n + '</a>').join(' ');
  const cls = c.classification ? ' <span class="cl-tag">' + esc(c.classification) + '</span>' : '';
  const props = c.props && c.props.length ? ' <span class="cl-byline">by ' + esc(c.props.join(', ')) + '</span>' : '';
  const desc = c.description ? '<div class="cl-desc">' + codefmt(c.description.replace(/\s+/g, ' ').trim()) + '</div>' : '';
  return '<li>' + ref + ' ' + codefmt(c.subject) + cls + (tix ? ' ' + tix : '') + props + desc + '</li>';
}
function coreGroup(comp, items) { return '<h3 class="cl-sub">' + esc(comp) + ' <span class="cl-count">(' + items.length + ')</span></h3><ul class="cl-list">' + items.map(coreItem).join('') + '</ul>'; }

function changelogBodyHtml(data) {
  const { meta, report } = data;
  const s = data.sources || {};
  let cl = '';
  if (report.gutenberg.byCategory || report.gutenberg.commits.length) {
    cl += '<section class="cl-group">' + groupHeadHtml('Gutenberg', s.gutenberg, meta.gbBranch);
    if (report.gutenberg.byCategory) sortGroups(report.gutenberg.byCategory).forEach((g) => { cl += gbGroup(g[0], g[1]); });
    else cl += '<ul class="cl-list">' + report.gutenberg.commits.map(gbItem).join('') + '</ul>';
    cl += '</section>';
  }
  cl += '<section class="cl-group">' + groupHeadHtml('Core', s.trac, meta.coreBranch);
  if (report.core.tracker) {
    cl += '<p class="cl-note">Grouped via <code>' + esc(report.core.tracker.slug) + '</code> dev-notes tracker.</p>';
    sortGroups(report.core.byComponent, true).forEach((g) => { cl += coreGroup(g[0], g[1]); });
  } else {
    if (meta.trackerMissing) cl += '<p class="cl-note">No dev-notes tracker for this milestone. Core stays ungrouped.</p>';
    cl += '<ul class="cl-list">' + report.core.commits.map(coreItem).join('') + '</ul>';
  }
  cl += '</section>';
  return cl;
}

// Styles for the HTML-string changelog body (Chakra css prop, resolves tokens).
const changelogCss = {
  '& .cl-group': { mt: '12' },
  '& .cl-group:first-of-type': { mt: '0' },
  '& .cl-title': { fontSize: 'clamp(1.25rem, 1.12rem + 0.65vw, 1.4375rem)', fontWeight: '700', color: 'ui.heading', letterSpacing: '-.01em', borderBottom: '2px solid', borderColor: 'ui.border', pb: '3', mb: '4' },
  '& .cl-title .cl-byline': { fontSize: '0.875rem' },
  '& .cl-link': { display: 'inline-flex', alignItems: 'center', gap: '2', color: 'ui.heading' },
  '& .cl-link svg': { color: 'ui.muted', transition: 'color .12s' },
  '& .cl-link:hover': { color: 'ui.accent' },
  '& .cl-link:hover svg': { color: 'ui.accent' },
  '& .cl-sub': { fontSize: '0.8125rem', fontWeight: '700', letterSpacing: '.04em', textTransform: 'uppercase', color: 'ui.muted', mt: '6', mb: '2' },
  '& .cl-count': { color: 'ui.muted', fontWeight: '500' },
  '& .cl-list': { my: '2', pl: '5', listStyle: 'disc' },
  '& .cl-list li': { my: '1.5', contentVisibility: 'auto', containIntrinsicSize: 'auto 2rem' },
  '& .cl-list a, & .cl-ref': { fontWeight: '600' },
  '& .cl-ref': { whiteSpace: 'nowrap' },
  '& .cl-tag': { display: 'inline-block', bg: 'ui.tagbg', color: 'ui.tagfg', borderRadius: 'sm', px: '1.5', fontSize: '0.6875rem', fontWeight: '600', ml: '1' },
  '& .cl-byline': { color: 'ui.muted', fontSize: '0.8125rem', fontWeight: '400' },
  '& .cl-desc': { color: 'ui.muted', fontSize: '0.8125rem', lineHeight: '1.5', mt: '1', mb: '2', maxW: '70ch' },
  '& .cl-note': { color: 'ui.muted', fontSize: '0.8125rem' },
  '& code': { bg: 'ui.tagbg', color: 'ui.tagfg', px: '1.5', borderRadius: 'sm', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.75rem' },
  '& a': { color: 'ui.primary' },
};

// ---- Hover hint (CSS-only popover, via data-tip) ----
// No icon: the wrapped text is itself the trigger. A dotted underline signals
// it's hoverable; the popover card appears on hover / keyboard focus.
function Hint({ tip, underline = true, children }) {
  return (
    <chakra.span tabIndex={0} aria-label={tip} data-tip={tip} position="relative" cursor="help"
      textDecoration={underline ? 'underline' : undefined} textDecorationStyle="dotted" textDecorationColor="ui.border" textUnderlineOffset="3px"
      css={{
        '&::after': { content: 'attr(data-tip)', position: 'absolute', top: 'calc(100% + 0.4375rem)', left: 0, bg: 'ui.surface', color: 'ui.text', borderWidth: '1px', borderColor: 'ui.border', p: '2', borderRadius: 'sm', font: '400 0.75rem/1.4 var(--chakra-fonts-body)', width: '13rem', textAlign: 'left', whiteSpace: 'normal', opacity: 0, visibility: 'hidden', pointerEvents: 'none', transition: 'opacity .12s, visibility .12s', zIndex: 40, boxShadow: 'md' },
        '&:hover::after, &:focus-visible::after': { opacity: 1, visibility: 'visible' },
      }}>{children}</chakra.span>
  );
}

// ---- Date range picker ----
const calCss = {
  '& .cal-cell': { height: '2.25rem', border: 0, bg: 'none', font: '500 0.8125rem/1 var(--chakra-fonts-body)', color: 'ui.text', cursor: 'pointer', borderRadius: 'sm', display: 'inline-grid', placeItems: 'center', p: 0 },
  '& .cal-cell:hover': { bg: 'ui.sunk' },
  '& .cal-cell.is-empty': { visibility: 'hidden', cursor: 'default' },
  '& .cal-cell.is-today': { boxShadow: 'inset 0 0 0 1.5px var(--chakra-colors-navy)', color: 'navy', fontWeight: '700' },
  '& .cal-cell.is-inrange': { bg: 'ui.rangeFill', borderRadius: 0, color: 'navy' },
  '& .cal-cell.is-start, & .cal-cell.is-end': { bg: 'navy', color: 'white', fontWeight: '700' },
  '& .cal-cell.is-start': { borderRadius: '0.3125rem 0 0 0.3125rem' },
  '& .cal-cell.is-end': { borderRadius: '0 0.3125rem 0.3125rem 0' },
  '& .cal-cell.is-start.is-end': { borderRadius: 'sm' },
  '& .cal-cell.is-disabled': { color: 'ui.muted', opacity: 0.35, cursor: 'not-allowed' },
  '& .cal-cell.is-disabled:hover': { bg: 'none' },
};

function DateRangePicker({ since, until, onChange }) {
  const today = useRef((() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })()).current;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => { const e = until ? until.split('-') : null; return e ? new Date(+e[0], +e[1] - 1, 1) : new Date(today.getFullYear(), today.getMonth(), 1); });
  const [pendStart, setPendStart] = useState(null);
  const [hoverDay, setHoverDay] = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) close(); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  function close() { setOpen(false); setPendStart(null); setHoverDay(null); }
  const tISO = isoD(today);
  const nextDisabled = view.getFullYear() > today.getFullYear() || (view.getFullYear() === today.getFullYear() && view.getMonth() >= today.getMonth());

  let s, e;
  if (pendStart) {
    if (hoverDay) { s = pendStart < hoverDay ? pendStart : hoverDay; e = pendStart < hoverDay ? hoverDay : pendStart; }
    else { s = pendStart; e = null; }
  } else { s = since; e = until; }

  const startDow = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(<chakra.button key={'e' + i} type="button" className="cal-cell is-empty" tabIndex={-1} />);
  for (let day = 1; day <= days; day++) {
    const ds = view.getFullYear() + '-' + pad(view.getMonth() + 1) + '-' + pad(day);
    let cls = 'cal-cell';
    if (ds > tISO) cls += ' is-disabled';
    if (ds === tISO) cls += ' is-today';
    if (s && e) { if (ds === s) cls += ' is-start'; if (ds === e) cls += ' is-end'; if (ds > s && ds < e) cls += ' is-inrange'; }
    else if (s && ds === s) cls += ' is-start is-end';
    const disabled = ds > tISO;
    cells.push(
      <chakra.button key={ds} type="button" className={cls} data-d={ds}
        onClick={() => { if (disabled) return; pick(ds); }}
        onMouseOver={() => { if (!disabled && pendStart && ds !== hoverDay) setHoverDay(ds); }}>{day}</chakra.button>
    );
  }
  function pick(ds) {
    if (!pendStart) { setPendStart(ds); setHoverDay(ds); }
    else {
      let a = pendStart, b = ds; if (b < a) { const t = a; a = b; b = t; }
      onChange(a, b); setPendStart(null); setHoverDay(null); setOpen(false);
    }
  }
  function preset(n) {
    const ed = new Date(today), sd = new Date(today); sd.setDate(sd.getDate() - n);
    onChange(isoD(sd), isoD(ed)); setPendStart(null); setView(new Date(ed.getFullYear(), ed.getMonth(), 1)); setOpen(false);
  }
  const navBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', w: '1.875rem', h: '1.875rem', p: 0, borderRadius: 'sm', borderWidth: '1px', borderColor: 'ui.border', bg: 'ui.surface', color: 'ui.text', cursor: 'pointer', flex: 'none', _hover: { bg: 'ui.sunk', borderColor: 'ui.primary' }, _disabled: { opacity: 0.3, cursor: 'not-allowed' } };

  return (
    <Box position="relative" ref={wrapRef} display="flex" flexDir="column" gap="1.5">
      <Text as="span" fontSize="0.7813rem" fontWeight="600" letterSpacing=".04em" textTransform="uppercase" color="ui.muted">{__('Date range')}</Text>
      <chakra.button type="button" aria-haspopup="true" aria-expanded={open} onClick={(ev) => { ev.stopPropagation(); setOpen((o) => !o); }}
        display="inline-flex" alignItems="center" justifyContent="space-between" gap="2" minW="14rem" px="3.5" py="2.5" textAlign="left"
        bg="ui.surface" color="ui.text" borderWidth="1px" borderColor={open ? 'ui.primary' : 'ui.border'} borderRadius="0.4375rem" cursor="pointer"
        fontSize="1rem" _hover={{ borderColor: 'ui.primary' }}>
        <chakra.span>{since && until ? fmtRange(since, until) : __('Pick dates')}</chakra.span>
        <CalendarIcon size={16} className="cal-trigger-icon" />
      </chakra.button>
      {open && (
        <Box onClick={(ev) => ev.stopPropagation()} position="absolute" top="calc(100% + 0.5rem)" left="0" zIndex="30" w="18.75rem"
          bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="forge" boxShadow="lg" p="3" css={calCss}>
          <Flex flexWrap="wrap" gap="1.5" mb="2.5">
            {[7, 14, 30].map((p) => (
              <chakra.button key={p} type="button" onClick={() => preset(p)} font="500 0.75rem/1 var(--chakra-fonts-body)"
                bg="ui.sunk" borderWidth="1px" borderColor="ui.border" color="ui.text" borderRadius="sm" px="3" py="1.5" cursor="pointer"
                _hover={{ borderColor: 'navy', color: 'navy' }}>{__('%s days', p)}</chakra.button>
            ))}
          </Flex>
          <Flex align="center" justify="space-between" mb="2">
            <chakra.button type="button" aria-label={__('Previous month')} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} css={navBtn}><ArrowLeft size={18} /></chakra.button>
            <Text fontWeight="700" fontSize="0.875rem" color="ui.heading">{__(MON[view.getMonth()]) + ' ' + view.getFullYear()}</Text>
            <chakra.button type="button" aria-label={__('Next month')} disabled={nextDisabled} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} css={navBtn}><ArrowRight size={18} /></chakra.button>
          </Flex>
          <Grid templateColumns="repeat(7, minmax(0, 1fr))" gap="0.5" mb="1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <Text key={d} textAlign="center" fontSize="0.6875rem" fontWeight="600" color="ui.muted" py="1">{__(d)}</Text>)}
          </Grid>
          <Grid templateColumns="repeat(7, minmax(0, 1fr))" autoRows="2.25rem" gap="0.5"
            onMouseLeave={() => { if (pendStart && hoverDay !== pendStart) setHoverDay(pendStart); }}>{cells}</Grid>
        </Box>
      )}
    </Box>
  );
}

// ---- Results view ----
function StatCard({ n, label, counted }) {
  return (
    <Box bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="forge" px="5" py="4" boxShadow="sm"
      transition="transform .12s, box-shadow .12s" _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
      css={counted ? { boxShadow: 'inset 0 2.5px 0 var(--chakra-colors-yellow), var(--chakra-shadows-sm)' } : undefined}>
      <chakra.b display="block" fontSize="clamp(1.6rem, 1.4rem + 0.9vw, 2.1875rem)" fontWeight="700" color="ui.heading" lineHeight="1.05" fontVariantNumeric="tabular-nums">{n}</chakra.b>
      <Text display="block" color="ui.muted" fontSize="0.7813rem">{label}</Text>
      {counted && <Badge mt="1.5" colorPalette="brand" variant="subtle" textTransform="uppercase" fontSize="0.625rem" letterSpacing=".05em">{__('in total')}</Badge>}
    </Box>
  );
}

function SrcRow({ url, text, onCopy }) {
  return (
    <Flex align="center" gap="3" py="3" borderTop="1px solid" borderColor="ui.border" _first={{ borderTop: '0' }}>
      <Link href={url} target="_blank" rel="noopener" flex="1" wordBreak="break-word" fontSize="0.875rem" fontWeight="600" color="ui.primary" dangerouslySetInnerHTML={{ __html: text }} />
      <UButton variant="ghost" size="sm" onClick={onCopy}><Ic html={IC.link} />{__('Copy link')}</UButton>
    </Flex>
  );
}

function Results({ data, since, until }) {
  const core = useCore();
  const [tab, setTab] = useState('changelog');
  const [propsAt, setPropsAt] = useState(false);
  const [devNotes, setDevNotes] = useState(null);
  const meta = data.meta, report = data.report, t = report.totals;
  useEffect(() => {
    if (!meta.milestone) { setDevNotes([]); return; }
    fetch('/api/devnotes?milestone=' + encodeURIComponent(meta.milestone))
      .then((r) => r.json()).then((d) => setDevNotes(d.notes || [])).catch(() => setDevNotes([]));
  }, [meta.milestone]);
  const issues = (t.coreTickets || 0) + (t.gutenbergPRs || 0);
  const changes = (t.gutenbergCommits || 0) + (t.coreChangesets || 0);
  const coreTicketsShown = report.core.tracTicketCount != null ? report.core.tracTicketCount : (t.coreTickets || 0);
  const all = useMemo(() => uniq((report.gutenberg.contributors || []).concat(report.core.contributors || [])
    .map(cleanName).filter((n) => n && !isBot(n)))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())), [report]);
  const dn = !!meta.devNotesOnly;
  const s = data.sources || {};
  const bodyHtml = useMemo(() => changelogBodyHtml(data), [data]);

  const withAt = (n) => (propsAt ? '@' : '') + n;
  const propsLine = all.map(withAt).join(', ');
  const copy = (text, label) => { navigator.clipboard.writeText(text); core.toast(label); };
  function downloadMd() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data.markdown], { type: 'text/markdown' }));
    a.download = 'changelog.md'; a.click(); core.toast(__('Downloaded changelog.md'));
  }
  function copyCsv() { copy(all.map(withAt).join('\n'), __('CSV copied')); }
  function copyPhp() {
    const arr = all.map((n) => "\t'" + withAt(n).replace(/'/g, "\\'") + "',");
    copy('array(\n' + arr.join('\n') + '\n)', __('PHP array copied'));
  }
  const bigNum = { position: 'relative', fontWeight: '700', color: 'ui.heading', lineHeight: '1', letterSpacing: '-.03em', pb: '1.5', fontVariantNumeric: 'tabular-nums' };
  const underline = { content: '""', position: 'absolute', left: 0, bottom: 0, width: '100%', height: '0.375rem', bg: 'yellow', borderRadius: 'full' };

  return (
    <Box mt="8">
      <Flex align="baseline" gap="4" mb="8" flexWrap="wrap">
        <chakra.b {...bigNum} fontSize="clamp(2.5rem, 1.9rem + 2.6vw, 3.5rem)" css={{ '&::after': underline }}>{dn ? issues : changes}</chakra.b>
        <Text color="ui.muted" fontSize="0.9375rem">{dn
          ? __('dev notes / field guide tickets, %s', fmtRange(since, until))
          : <Hint tip={__('%s Gutenberg changes + %s Core changesets', t.gutenbergCommits, t.coreChangesets)} underline={false}>{__('changes landed across Core and Gutenberg, %s', fmtRange(since, until))}</Hint>}</Text>
      </Flex>
      <SimpleGrid columns={{ base: 2, md: 4 }} gap="3" mb="8">
        {!dn && <StatCard n={t.gutenbergCommits} label={__('Gutenberg changes')} counted />}
        <StatCard n={t.coreChangesets} label={dn ? __('Dev-note changesets') : __('Core changesets')} counted={!dn} />
        <StatCard n={coreTicketsShown} label={dn ? __('Dev-note tickets') : __('Core tickets')} counted={dn} />
        <StatCard n={all.length} label={__('Contributors')} />
      </SimpleGrid>

      {meta.deepError && (
        <Box bg="rgba(252,190,0,.12)" border="1px solid" borderColor="rgba(252,190,0,.45)" color="ui.text" borderRadius="forge" px="3.5" py="2.5" fontSize="0.875rem" mb="6">{__('MCP enrichment skipped (%s). Descriptions still show, sourced from the GitHub commit bodies.', esc(meta.deepError))}</Box>
      )}

      <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value)} variant="line" colorPalette="brand"
        css={{ '& [data-part="trigger"][data-selected]': { color: 'ui.heading' } }}>
        <Tabs.List borderBottom="1px solid" borderColor="ui.border">
          <Tabs.Trigger value="changelog" fontWeight="600">{__('Changelog')}<Badge ml="2" variant="subtle" colorPalette="brand">{changes}</Badge></Tabs.Trigger>
          <Tabs.Trigger value="props" fontWeight="600">{__('Props')}<Badge ml="2" variant="subtle" colorPalette="brand">{all.length}</Badge></Tabs.Trigger>
          <Tabs.Trigger value="devnotes" fontWeight="600">{__('Dev Notes')}{devNotes ? <Badge ml="2" variant="subtle" colorPalette="brand">{devNotes.length}</Badge> : null}</Tabs.Trigger>
          <HStack ml="auto" gap="2" pb="2">
            <UButton variant="ghost" size="sm" onClick={() => copy(data.markdown, __('Markdown copied'))}><Ic html={IC.md} />{__('Copy Markdown')}</UButton>
            <UButton variant="ghost" size="sm" onClick={downloadMd}><Ic html={IC.down} />{__('Download')}</UButton>
          </HStack>
        </Tabs.List>

        <Tabs.Content value="changelog">
          {data.sources && (
            <Box as="section" bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="forge" boxShadow="md" px="6" py="5" mb="6">
              <Heading as="h2" fontSize="1.25rem" fontWeight="700" color="ui.heading" mb="3" letterSpacing="-.01em">{__('Sources')} <chakra.em fontStyle="normal" fontWeight="500" color="ui.muted" fontSize="0.8125rem">{__('link these in the post so anyone can verify')}</chakra.em></Heading>
              <SrcRow url={s.trac} text={__('Closed Core Trac tickets') + (s.milestone ? __(' (milestone %s)', esc(s.milestone)) : '') + ', ' + __('%s to %s', esc(s.since), esc(s.until))} onCopy={() => copy(s.trac, __('Link copied'))} />
              <SrcRow url={s.gutenberg} text={__('Gutenberg commits on %s', esc(s.gbBranch)) + ', ' + __('%s to %s', esc(s.since), esc(s.until))} onCopy={() => copy(s.gutenberg, __('Link copied'))} />
            </Box>
          )}
          <Box css={changelogCss} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          <chakra.details mt="4">
            <chakra.summary cursor="pointer" color="ui.muted" fontSize="0.8125rem" fontWeight="500">{__('Raw Markdown')}</chakra.summary>
            <chakra.pre mt="3" bg="ui.sunk" borderWidth="1px" borderColor="ui.border" borderRadius="forge" p="4" overflowX="auto" fontSize="0.75rem" lineHeight="1.55">{data.markdown}</chakra.pre>
          </chakra.details>
        </Tabs.Content>

        <Tabs.Content value="props">
          <Flex align="flex-end" justify="space-between" gap="4" flexWrap="wrap" mb="6">
            <Flex align="baseline" gap="3" flexWrap="wrap">
              <chakra.b {...bigNum} fontSize="clamp(1.9rem, 1.55rem + 1.4vw, 2.5rem)" css={{ '&::after': underline }}>{all.length}</chakra.b>
              <Text fontSize="0.875rem" color="ui.muted">{__('contributors with props this window')}</Text>
            </Flex>
            <Flex align="center" gap="3" flexWrap="wrap">
              <CChk.Root checked={propsAt} colorPalette="brand" onCheckedChange={(d) => setPropsAt(d.checked === true)}>
                <CChk.HiddenInput /><CChk.Control _checked={{ bg: 'navy', borderColor: 'navy', color: 'white' }} /><CChk.Label fontSize="0.875rem">{__('Add @ before names')}</CChk.Label>
              </CChk.Root>
              <UButton variant="ghost" size="sm" onClick={() => copy(propsLine, __('Props copied'))}><Ic html={IC.clip} />{__('Copy props line')}</UButton>
              <UButton variant="ghost" size="sm" onClick={copyCsv}><Ic html={IC.table} />{__('CSV')}</UButton>
              <UButton variant="ghost" size="sm" onClick={copyPhp}><Ic html={IC.md} />{__('PHP array')}</UButton>
            </Flex>
          </Flex>
          <Text m="0" fontSize="0.9688rem" lineHeight="1.85" color="ui.text">{propsLine}</Text>
          {propsAt && <Text mt="3" color="ui.muted" fontSize="0.8125rem">{__('Slack handles usually match the wp.org username, but not always. Double-check before pinging.')}</Text>}
        </Tabs.Content>

        <Tabs.Content value="devnotes">
          <Text color="ui.muted" fontSize="0.8125rem">{__('Published dev notes for')} {meta.milestone ? <b>{meta.milestone}</b> : __('this milestone')}, {__('from')} <Link href={'https://make.wordpress.org/core/tag/dev-notes-' + String(meta.milestone || '').replace(/\./g, '-') + '/'} target="_blank" rel="noopener" color="ui.primary" fontWeight="600">make.wordpress.org/core</Link> {__('(the tagged Field Guide source).')}</Text>
          {devNotes === null ? <Text mt="2" color="ui.muted" fontSize="0.8125rem">{__('Loading dev notes…')}</Text>
            : devNotes.length === 0 ? <Box textAlign="center" py="12"><Heading as="h3" fontSize="1.125rem" color="ui.heading" fontWeight="700" mb="2">{__('No dev notes yet')}</Heading><Text color="ui.muted" fontSize="0.9688rem">{__('make.wordpress.org has no dev-notes-%s posts yet. They land as the release nears.', String(meta.milestone || '').replace(/\./g, '-'))}</Text></Box>
            : <Stack as="ul" listStyleType="none" gap="0" mt="3">{devNotes.map((n, i) => (
                <chakra.li key={i} py="4" borderTop={i ? '1px solid' : '0'} borderColor="ui.border">
                  <Link href={n.url} target="_blank" rel="noopener" fontWeight="600" fontSize="0.9375rem" color="ui.heading" _hover={{ color: 'ui.accent' }}>{n.title}</Link>
                  <chakra.span ml="3" fontSize="0.75rem" color="ui.muted">{n.date}</chakra.span>
                  {n.excerpt && <Text mt="1.5" fontSize="0.8125rem" color="ui.muted" lineHeight="1.5">{n.excerpt}…</Text>}
                </chakra.li>
              ))}</Stack>}
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  );
}

// ---- The tool ----
// Loading placeholder shown while the changelog is being fetched.
function ResultsSkeleton() {
  return (
    <Box mt="8">
      <Flex align="baseline" gap="4" mb="8" flexWrap="wrap"><Skeleton h="3rem" w="7rem" /><Skeleton h="1rem" w="18rem" /></Flex>
      <SimpleGrid columns={{ base: 2, md: 4 }} gap="3" mb="8">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} h="4.75rem" borderRadius="forge" />)}
      </SimpleGrid>
      <Skeleton h="2.5rem" w="22rem" maxW="100%" mb="5" />
      <Stack gap="2.5">
        {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} h="2.75rem" borderRadius="sm" />)}
      </Stack>
    </Box>
  );
}

export default function ChangelogTool() {
  const core = useCore();
  const t = useT();
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [milestones, setMilestones] = useState([]);
  const [gbBranches, setGbBranches] = useState([]);
  const [coreBranches, setCoreBranches] = useState([]);
  const [milestone, setMilestone] = useState('');
  const [gbBranch, setGbBranch] = useState('');
  const [coreBranch, setCoreBranch] = useState('trunk');
  const [loaded, setLoaded] = useState(false);
  const [labels, setLabels] = useState(true);
  const [devNotes, setDevNotes] = useState(true);
  const [devOnly, setDevOnly] = useState(false);
  const [full, setFull] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    const d = new Date(), sd = new Date(d); sd.setDate(sd.getDate() - 7);
    setSince(isoD(sd)); setUntil(isoD(d));
  }, []);

  useEffect(() => {
    let alive = true;
    const gb = fetch('/api/branches?repo=gutenberg').then((r) => r.json()).then((d) => {
      if (!alive) return;
      const list = d.branches || [], versions = [];
      list.forEach((b) => { if (b.indexOf('wp/') === 0) { const v = b.slice(3); if (/^[0-9]+[.][0-9]+$/.test(v) && versions.indexOf(v) === -1) versions.push(v); } });
      setGbBranches(list); setMilestones(versions);
      if (versions.length) { setMilestone(versions[0]); const want = 'wp/' + versions[0]; if (list.indexOf(want) !== -1) setGbBranch(want); }
    }).catch(() => {});
    const cr = fetch('/api/branches?repo=core').then((r) => r.json()).then((d) => {
      if (alive) setCoreBranches((d.branches || []).slice(0, 80));
    }).catch(() => {});
    Promise.all([gb, cr]).then(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const onMilestone = useCallback((v) => {
    setMilestone(v);
    const want = 'wp/' + v;
    setGbBranches((list) => { if (list.indexOf(want) !== -1) setGbBranch(want); return list; });
  }, []);

  function reset() {
    const d = new Date(), sd = new Date(d); sd.setDate(sd.getDate() - 7);
    setSince(isoD(sd)); setUntil(isoD(d));
    if (milestones.length) onMilestone(milestones[0]);
    setCoreBranch('trunk'); setLabels(true); setDevNotes(true); setDevOnly(false); setFull(false);
    setStatus(''); setData(null);
  }

  function submit(e) {
    e.preventDefault();
    if (!since || !until) { setStatus(__('Pick a date range first.')); return; }
    setBusy(true); setData(null);
    setStatus('__spin__ ' + __('Fetching commits, labels and dev-notes…'));
    const p = new URLSearchParams({
      since, until, milestone: milestone.trim(), gbBranch: gbBranch.trim(), coreBranch: coreBranch.trim(),
      labels, devNotes, devNotesOnly: devOnly, deep: full,
    });
    fetch('/api/report?' + p).then((r) => r.json().then((d) => { if (!r.ok) throw new Error(d.error || 'request failed'); return d; }))
      .then((d) => { setData(d); setStatus(''); })
      .catch((err) => {
        const m = err.message || 'request failed';
        if (/rate limit|\b403\b/i.test(m)) { setStatus(__('GitHub rate limit reached. That is the anonymous 60 requests/hour. Add a GitHub token in Setup (any account, no scopes) for 5000/hour, then try again.')); core.openSetup(); }
        else if (/cookie/i.test(m)) { setStatus(__('Error: %s', m)); core.openSetup(); }
        else setStatus(__('Error: %s', m));
      })
      .finally(() => setBusy(false));
  }

  const fieldLabel = { fontSize: '0.7813rem', fontWeight: '600', letterSpacing: '.04em', textTransform: 'uppercase', color: 'ui.muted', mb: '1.5', display: 'block' };
  const CHECKS = [
    [labels, setLabels, t('Group Gutenberg'), t('Group Gutenberg changes by label.')],
    [devNotes, setDevNotes, t('Group Core'), t('Group Core changes by component.')],
    [devOnly, setDevOnly, t('Dev notes only'), t('Show only Core dev-note tickets.')],
    [full, setFull, t('Full descriptions'), t("Show each change's full text from GitHub.")],
  ];

  return (
    <>
      <Box bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="forge" boxShadow="sm" px="6" py="6" mb="8">
        {!loaded ? (
          <Flex align="center" justify="center" gap="2.5" color="ui.muted" fontSize="0.875rem" py="12">Loading milestones and branches…</Flex>
        ) : (
          <chakra.form onSubmit={submit}>
            <Flex flexWrap="wrap" gap={{ base: '4', lg: '6' }} align="flex-end">
              <Box flex="1.3 1 14rem"><DateRangePicker since={since} until={until} onChange={(a, b) => { setSince(a); setUntil(b); }} /></Box>
              <Box flex="1 1 10rem"><chakra.label css={fieldLabel}>{t('Milestone')}</chakra.label><Select block searchable ariaLabel={t('Milestone')} value={milestone} onChange={onMilestone} options={milestones.map((v) => ({ value: v, label: v }))} placeholder={t('Select')} /></Box>
              <Box flex="1 1 10rem"><chakra.label css={fieldLabel}>{t('Gutenberg branch')}</chakra.label><Select block searchable ariaLabel={t('Gutenberg branch')} value={gbBranch} onChange={setGbBranch} options={gbBranches.map((b) => ({ value: b, label: b }))} placeholder={t('Select')} /></Box>
              <Box flex="1 1 10rem"><chakra.label css={fieldLabel}>{t('Core branch')}</chakra.label><Select block searchable ariaLabel={t('Core branch')} value={coreBranch} onChange={setCoreBranch} options={coreBranches.map((b) => ({ value: b, label: b }))} placeholder={t('Select')} /></Box>
            </Flex>
            <Flex align={{ base: 'stretch', lg: 'center' }} justify="space-between" gap="4" mt="6" pt="4" borderTop="1px solid" borderColor="ui.border" direction={{ base: 'column', lg: 'row' }}>
              <Flex align="center" gap={{ base: '4', lg: '6' }} flexWrap="wrap">
                {CHECKS.map(([val, set, label, tip]) => (
                  <CChk.Root key={label} checked={val} colorPalette="brand" onCheckedChange={(d) => set(d.checked === true)}>
                    <CChk.HiddenInput /><CChk.Control _checked={{ bg: 'navy', borderColor: 'navy', color: 'white' }} /><CChk.Label fontSize="0.875rem" fontWeight="500" whiteSpace="nowrap"><Hint tip={tip}>{label}</Hint></CChk.Label>
                  </CChk.Root>
                ))}
              </Flex>
              <Flex align="center" gap="4" justify={{ base: 'flex-end', lg: 'initial' }}>
                <chakra.button type="button" onClick={reset} bg="none" border="0" color="ui.muted" fontSize="0.8125rem" cursor="pointer" textDecoration="underline" p="1" _hover={{ color: 'navy' }}>{t('Reset')}</chakra.button>
                <UButton variant="primary" type="submit" disabled={busy} px="7.5" fontSize="1rem" fontWeight="700">{t('Generate')}</UButton>
              </Flex>
            </Flex>
          </chakra.form>
        )}
      </Box>

      {status && <Flex align="center" gap="2.5" my="6" mx="0.5" color="ui.muted" minH="1.25rem" fontSize="0.9688rem" role="status" aria-live="polite">{status.startsWith('__spin__') ? <><Spinner size="sm" borderWidth="2px" color="navy" flex="none" /><chakra.span>{status.slice(8)}</chakra.span></> : status}</Flex>}

      {data ? <Results data={data} since={since} until={until} />
        : busy ? <ResultsSkeleton />
          : (!status && (
            <Box mt="8"><Box textAlign="center" py="16" px="5">
              <chakra.img src="/brand/bulb.svg" alt="" w="3.5rem" h="3.5rem" opacity="0.95" mb="4" mx="auto" />
              <Heading as="h3" fontSize="1.125rem" color="ui.heading" fontWeight="700" mb="2">{t('No changelog yet')}</Heading>
              <Text mx="auto" maxW="48ch" color="ui.muted" fontSize="0.9688rem" lineHeight="1.6">{t('Pick a date range and a milestone, then Generate. You get the counts, the source links, the grouped changelog, and the props.')}</Text>
            </Box></Box>
          ))}
    </>
  );
}
