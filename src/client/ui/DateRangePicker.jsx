// Date-range picker: a calendar popover that returns a { since, until } pair as
// YYYY-MM-DD strings. Extracted from the Changelog tool so any plugin reuses the
// same control (the shell's date input). Self-contained: it carries the small
// date/locale helpers it needs.
import { useState, useEffect, useRef } from 'react';
import { Box, Flex, Grid, Text, chakra } from '@chakra-ui/react';
import { useI18n, __, currentLocale } from '../i18n.jsx';
import { CalendarIcon, ArrowLeft, ArrowRight } from '../icons.jsx';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// First weekday for a locale: 0 = Sunday, 1 = Monday. Uses Intl week info when
// exposed, with a locale-prefix fallback for older browsers.
function weekStartFor(locale) {
  try {
    const loc = new Intl.Locale(locale);
    const info = loc.weekInfo || (typeof loc.getWeekInfo === 'function' ? loc.getWeekInfo() : null);
    if (info && info.firstDay) return info.firstDay % 7;
  } catch { /* older browser: fall through */ }
  return String(locale || '').toLowerCase().startsWith('en') ? 0 : 1;
}

function pad(n) { return (n < 10 ? '0' : '') + n; }
function isoD(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
const parseISO = (iso) => new Date(iso + 'T00:00:00');
// Locale-correct range with a shared year/month collapsed by Intl itself.
function fmtRange(a, b) {
  try { return new Intl.DateTimeFormat(currentLocale(), { day: 'numeric', month: 'short', year: 'numeric' }).formatRange(parseISO(a), parseISO(b)); }
  catch { return a + ' – ' + b; }
}

const calCss = {
  '& .cal-cell': { height: '2.25rem', border: 0, bg: 'none', font: '500 0.8125rem/1 var(--chakra-fonts-body)', color: 'ui.text', cursor: 'pointer', borderRadius: 'sm', display: 'inline-grid', placeItems: 'center', p: 0 },
  '& .cal-cell:hover': { bg: 'ui.sunk' },
  '& .cal-cell.is-empty': { visibility: 'hidden', cursor: 'default' },
  '& .cal-cell.is-today': { boxShadow: 'inset 0 0 0 1.5px var(--chakra-colors-ui-primary)', color: 'ui.primary', fontWeight: '700' },
  '& .cal-cell.is-inrange': { bg: 'ui.rangeFill', borderRadius: 0, color: 'ui.heading' },
  '& .cal-cell.is-start, & .cal-cell.is-end': { bg: 'navy', color: 'white', fontWeight: '700' },
  '& .cal-cell.is-start': { borderRadius: '0.3125rem 0 0 0.3125rem' },
  '& .cal-cell.is-end': { borderRadius: '0 0.3125rem 0.3125rem 0' },
  '& .cal-cell.is-start.is-end': { borderRadius: 'sm' },
  '& .cal-cell.is-disabled': { color: 'ui.muted', opacity: 0.35, cursor: 'not-allowed' },
  '& .cal-cell.is-disabled:hover': { bg: 'none' },
};

export function DateRangePicker({ since, until, onChange }) {
  const today = useRef((() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })()).current;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => { const e = until ? until.split('-') : null; return e ? new Date(+e[0], +e[1] - 1, 1) : new Date(today.getFullYear(), today.getMonth(), 1); });
  const [pendStart, setPendStart] = useState(null);
  const [hoverDay, setHoverDay] = useState(null);
  const wrapRef = useRef(null);
  const { locale } = useI18n();
  const weekStart = weekStartFor(locale);
  const weekDays = WEEKDAYS.slice(weekStart).concat(WEEKDAYS.slice(0, weekStart));

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
  const lead = (startDow - weekStart + 7) % 7;
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(<chakra.button key={'e' + i} type="button" className="cal-cell is-empty" tabIndex={-1} />);
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
            <Text fontWeight="700" fontSize="0.875rem" color="ui.heading">{new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(view)}</Text>
            <chakra.button type="button" aria-label={__('Next month')} disabled={nextDisabled} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} css={navBtn}><ArrowRight size={18} /></chakra.button>
          </Flex>
          <Grid templateColumns="repeat(7, minmax(0, 1fr))" gap="0.5" mb="1">
            {weekDays.map((d) => <Text key={d} textAlign="center" fontSize="0.6875rem" fontWeight="600" color="ui.muted" py="1">{__(d)}</Text>)}
          </Grid>
          <Grid templateColumns="repeat(7, minmax(0, 1fr))" autoRows="2.25rem" gap="0.5"
            onMouseLeave={() => { if (pendStart && hoverDay !== pendStart) setHoverDay(pendStart); }}>{cells}</Grid>
        </Box>
      )}
    </Box>
  );
}
