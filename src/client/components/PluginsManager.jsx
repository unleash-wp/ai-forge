// The visible plugin system: a polished vertical list with WordPress-style bulk
// management (checkboxes + select-all + Bulk actions + Apply, only when there is
// a non-core tool to manage) and an updater (Check for updates + per-tool
// Update). Built from the global UI components in ./ui.jsx so it stays
// consistent with the rest of Forge. Installing/updating runs the tool's code
// after a server rebuild, gated behind the user's own action + a trust note.
import { useState, useEffect, useRef } from 'react';
import { ToolIcon } from '../icons.jsx';
import { useT } from '../i18n.jsx';
import { Button, Select, TextInput, Checkbox } from '../ui';
import { Badge, Box, Flex, HStack, Link, Text, chakra } from '@chakra-ui/react';

const NOTICE = { bg: 'rgba(252,190,0,.12)', border: '1px solid', borderColor: 'rgba(252,190,0,.45)', color: 'ui.text', borderRadius: 'forge', px: '3.5', py: '2.5', fontSize: '0.875rem', mb: '6' };

const VERB = { activate: 'Activating', deactivate: 'Deactivating', update: 'Updating', remove: 'Removing' };
const BULK_OPTIONS = [
  { value: 'activate', label: 'Activate' },
  { value: 'deactivate', label: 'Deactivate' },
  { value: 'update', label: 'Update' },
  { value: 'remove', label: 'Remove' },
];

export default function PluginsManager({ plugins, onOpen, onChanged }) {
  const [updates, setUpdates] = useState([]);
  const [source, setSource] = useState('');
  const [iq, setIq] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [bulk, setBulk] = useState('');
  const [updMsg, setUpdMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef(null);
  const t = useT();

  useEffect(() => {
    fetch('/api/updates').then((r) => r.json()).then((d) => setUpdates(d.updates || [])).catch(() => {});
  }, []);
  const upFor = (id) => updates.find((u) => u.id === id);
  const inactiveCount = plugins.filter((p) => p.enabled === false).length;

  function afterInstall(label, promise) {
    setErr(''); setBusy(label);
    promise
      .then((r) => r.json())
      .then((d) => { if (d.ok) { setBusy('Done. Reloading…'); window.location.reload(); } else { setBusy(''); setErr(d.error || 'failed'); } })
      .catch(() => { setBusy(''); setErr('request failed'); });
  }
  function installUrl() {
    const s = source.trim();
    if (!s) { setErr('Paste a GitHub repo URL first.'); return; }
    afterInstall('Installing from ' + s + '… building the bundle, then the page reloads.',
      fetch('/api/plugins/install', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: s }) }));
  }
  function uploadZip(file) {
    if (!file) return;
    afterInstall('Installing ' + file.name + '… building the bundle, then the page reloads.',
      fetch('/api/plugins/upload', { method: 'POST', body: file }));
  }
  function remove(id, name) {
    if (!window.confirm('Remove "' + name + '"? This deletes it from tools/ and rebuilds.')) return;
    afterInstall('Removing ' + name + '… rebuilding.',
      fetch('/api/plugins/uninstall', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }));
  }
  function toggle(id, enabled) {
    setErr('');
    fetch('/api/plugins/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, enabled }) })
      .then((r) => r.json())
      .then((d) => { if (d.ok) { if (onChanged) onChanged(); } else setErr(d.error || 'failed'); })
      .catch(() => setErr('request failed'));
  }
  function updateOne(id, name) {
    afterInstall('Updating ' + name + '… downloading + rebuilding.',
      fetch('/api/plugins/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', ids: [id] }) }));
  }
  function checkUpdates() {
    setUpdMsg('Checking…');
    fetch('/api/updates').then((r) => r.json()).then((d) => {
      const list = d.updates || [];
      setUpdates(list);
      setUpdMsg(list.length ? list.length + ' update' + (list.length > 1 ? 's' : '') + ' available' : 'All tools are up to date.');
    }).catch(() => setUpdMsg('Update check failed.'));
  }

  const shown = plugins
    .filter((p) => (filter === 'inactive' ? p.enabled === false : true))
    .filter((p) => (p.name + ' ' + (p.description || '')).toLowerCase().includes(iq.trim().toLowerCase()));
  const selectableIds = shown.filter((p) => p.id !== 'changelog').map((p) => p.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggleOne(id) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() { setSelected(allSelected ? new Set() : new Set(selectableIds)); }
  function applyBulk() {
    const ids = [...selected];
    if (!bulk || !ids.length) return;
    if (bulk === 'remove' && !window.confirm('Remove ' + ids.length + ' tool(s)? This deletes them and rebuilds.')) return;
    setErr(''); setBusy(VERB[bulk] + ' ' + ids.length + ' tool(s)…');
    fetch('/api/plugins/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: bulk, ids }) })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setBusy(''); setErr(d.error || 'failed'); return; }
        if (d.errors && d.errors.length) setErr(d.errors.join(' · '));
        if (d.rebuilt) { setBusy('Done. Reloading…'); window.location.reload(); }
        else { setBusy(''); setSelected(new Set()); setBulk(''); if (onChanged) onChanged(); }
      })
      .catch(() => { setBusy(''); setErr('request failed'); });
  }

  return (
    <>
      {busy && <Box {...NOTICE} role="status" aria-live="polite">{busy}</Box>}
      {err && <Box {...NOTICE} borderColor="ui.bad" color="ui.bad" role="alert">{err}</Box>}

      {plugins.length > 1 && (
        <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} gap="3" flexWrap="wrap" mb="3" direction={{ base: 'column', md: 'row' }}>
          <Flex display="inline-flex" bg="ui.sunk" borderWidth="1px" borderColor="ui.border" borderRadius="0.625rem" p="1" gap="1">
            {[['all', t('All'), plugins.length], ['inactive', t('Inactive'), inactiveCount]].map(([key, label, n]) => (
              <chakra.button key={key} type="button" onClick={() => setFilter(key)} display="inline-flex" alignItems="center" gap="1.5" px="3.5" py="2" borderRadius="0.4375rem" fontSize="0.8125rem" fontWeight={filter === key ? '600' : '500'} cursor="pointer" transition="color .12s, background .12s" bg={filter === key ? 'ui.surface' : 'transparent'} color={filter === key ? 'ui.heading' : 'ui.muted'} boxShadow={filter === key ? 'sm' : 'none'} _hover={{ color: 'ui.text' }}>
                {label} <chakra.span fontSize="0.6875rem" fontWeight="600" px="1.5" py="0.5" borderRadius="999px" color={filter === key ? 'ui.primary' : 'ui.muted'} bg={filter === key ? 'ui.ghostHover' : 'ui.tagbg'}>{n}</chakra.span>
              </chakra.button>
            ))}
          </Flex>
          <Flex align="center" gap="3" flexWrap="wrap" justify="flex-end">
            {updMsg && <Text fontSize="0.8125rem" color="ui.muted">{updMsg}</Text>}
            <Button variant="ghost" size="sm" onClick={checkUpdates}>{t('Check for updates')}</Button>
            <TextInput maxW="18rem" value={iq} onChange={(e) => setIq(e.target.value)} placeholder={t('Search installed tools…')} spellCheck="false" />
          </Flex>
        </Flex>
      )}

      {selectableIds.length > 0 && (
        <Flex align="center" gap="3" flexWrap="wrap" mb="3">
          <HStack as="label" gap="2" fontSize="0.8125rem" color="ui.muted"><Checkbox checked={allSelected} onChange={toggleAll} /> {t('Select all')}</HStack>
          <Select value={bulk} onChange={setBulk} options={BULK_OPTIONS} placeholder={t('Bulk actions')} ariaLabel={t('Bulk actions')} disabled={!!busy} />
          <Button variant="ghost" size="sm" onClick={applyBulk} disabled={!bulk || !selected.size || !!busy}>{t('Apply')}</Button>
          {selected.size > 0 && <Text fontSize="0.8125rem" color="ui.muted">{t('%s selected', selected.size)}</Text>}
        </Flex>
      )}

      <Box borderWidth="1px" borderColor="ui.border" borderRadius="0.875rem" bg="ui.surface" boxShadow="md" overflow="hidden">
        {shown.map((p) => {
          const up = upFor(p.id);
          const active = p.enabled !== false;
          const core = p.id === 'changelog';
          return (
            <Flex key={p.id} align="center" gap="4" px="6" py="4.5" transition="background .14s ease" opacity={active ? 1 : 0.6} borderTopWidth="1px" borderColor="ui.border" _first={{ borderTopWidth: '0' }} _hover={{ bg: 'ui.sunk' }} flexWrap={{ base: 'wrap', md: 'nowrap' }}>
              {selectableIds.length > 0 && (core
                ? <Box w="1.25rem" flex="none" aria-hidden="true" />
                : <Checkbox checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} aria-label={'Select ' + p.name} />)}
              <Flex display="grid" placeItems="center" w="2.75rem" h="2.75rem" flex="none" borderRadius="0.6875rem" color="white" bg={active ? 'linear-gradient(145deg, #2a3f6f, #0f131f)' : 'ui.slate'} boxShadow={active ? '0 2px 8px rgba(32,49,89,.28), inset 0 1px 0 rgba(255,255,255,.08)' : 'none'} css={{ '& svg': { width: '1.3125rem', height: '1.3125rem' } }}><ToolIcon name={p.icon} size={20} /></Flex>
              <Box flex="1" minW="0">
                <HStack gap="2">
                  <chakra.h3 m="0" fontSize="0.9375rem" fontWeight="600" color="ui.heading" letterSpacing="-.01em">{p.name}</chakra.h3>
                  {core && <Badge colorPalette="brand" variant="subtle" textTransform="uppercase" fontSize="0.625rem">{t('Core')}</Badge>}
                  {!active && <Badge variant="subtle" textTransform="uppercase" fontSize="0.625rem" color="ui.muted" bg="ui.tagbg">{t('Inactive')}</Badge>}
                  {up && <Badge bg="navy" color="white" fontSize="0.625rem">{t('Update available')}</Badge>}
                </HStack>
                <Text mt="1" fontSize="0.8125rem" color="ui.muted" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">{p.description}</Text>
                <Text mt="1.5" fontSize="0.6875rem" color="ui.muted">{t('Version %s', p.version)} · {t('By %s', p.author || t('unknown'))} · {p.price === 'free' ? t('Free') : p.price}</Text>
              </Box>
              <Flex gap="2" flex="none" align="center" w={{ base: 'full', md: 'auto' }} pl={{ base: 'calc(2.75rem + 1rem)', md: '0' }}>
                {up && !core && <Button variant="primary" size="sm" disabled={!!busy} onClick={() => updateOne(p.id, p.name)}>{t('Update to %s', up.latest)}</Button>}
                {active && <Button variant="ghost" size="sm" onClick={() => onOpen(p.id)}>{t('Open')}</Button>}
                {!core && <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => toggle(p.id, !active)}>{active ? t('Deactivate') : t('Activate')}</Button>}
                {!core && <Button variant="ghost" size="sm" danger disabled={!!busy} onClick={() => remove(p.id, p.name)}>{t('Remove')}</Button>}
              </Flex>
            </Flex>
          );
        })}
        {shown.length === 0 && <Box px="5" py="12" textAlign="center" color="ui.muted" fontSize="0.875rem">{t('No tools match.')}</Box>}
      </Box>
    </>
  );
}
