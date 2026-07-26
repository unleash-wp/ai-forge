// The visible plugin system: a polished vertical list with WordPress-style bulk
// management (checkboxes + select-all + Bulk actions + Apply, only when there is
// a non-core tool to manage) and an updater (Check for updates + per-tool
// Update). Built from the global UI components in ./ui.jsx so it stays
// consistent with the rest of Forge. Installing/updating runs the tool's code
// after a server rebuild, gated behind the user's own action + a trust note.
import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../core.jsx';
import { ToolIcon } from '../icons.jsx';
import { useT } from '../i18n.jsx';
import { Button, Select, TextInput, Checkbox } from '../ui';
import { Badge, Box, Flex, HStack, Link, Text, chakra } from '@chakra-ui/react';

const NOTICE = { bg: 'rgba(252,190,0,.12)', border: '1px solid', borderColor: 'rgba(252,190,0,.45)', color: 'ui.text', borderRadius: 'forge', px: '3.5', py: '2.5', fontSize: '0.875rem', mb: '6' };

const VERB = { activate: 'Activating', deactivate: 'Deactivating', update: 'Updating', remove: 'Removing' };

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
  const BULK_OPTIONS = [
    { value: 'activate', label: t('Activate') },
    { value: 'deactivate', label: t('Deactivate') },
    { value: 'update', label: t('Update') },
    { value: 'remove', label: t('Remove') },
  ];

  useEffect(() => {
    apiFetch('/api/updates').then((r) => r.json()).then((d) => setUpdates(d.updates || [])).catch(() => {});
  }, []);
  const upFor = (id) => updates.find((u) => u.id === id);
  const inactiveCount = plugins.filter((p) => p.enabled === false).length;

  function afterInstall(label, promise) {
    setErr(''); setBusy(label);
    promise
      .then((r) => r.json())
      .then((d) => { if (d.ok) { setBusy(t('Done. Reloading…')); window.location.reload(); } else { setBusy(''); setErr(d.error || t('failed')); } })
      .catch(() => { setBusy(''); setErr(t('request failed')); });
  }
  function installUrl() {
    const s = source.trim();
    if (!s) { setErr(t('Paste a GitHub repo URL first.')); return; }
    afterInstall(t('Installing from %s… building the bundle, then the page reloads.', s),
      apiFetch('/api/plugins/install', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: s }) }));
  }
  function uploadZip(file) {
    if (!file) return;
    afterInstall(t('Installing %s… building the bundle, then the page reloads.', file.name),
      apiFetch('/api/plugins/upload', { method: 'POST', body: file }));
  }
  function remove(id, name) {
    if (!window.confirm(t('Remove "%s"? This deletes it from plugins/ and rebuilds.', name))) return;
    afterInstall(t('Removing %s… rebuilding.', name),
      apiFetch('/api/plugins/uninstall', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }));
  }
  function toggle(id, enabled) {
    setErr('');
    apiFetch('/api/plugins/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, enabled }) })
      .then((r) => r.json())
      .then((d) => { if (d.ok) { if (onChanged) onChanged(); } else setErr(d.error || t('failed')); })
      .catch(() => setErr(t('request failed')));
  }
  function updateOne(id, name) {
    afterInstall(t('Updating %s… downloading + rebuilding.', name),
      apiFetch('/api/plugins/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', ids: [id] }) }));
  }
  function checkUpdates() {
    setUpdMsg(t('Checking…'));
    apiFetch('/api/updates').then((r) => r.json()).then((d) => {
      const list = d.updates || [];
      setUpdates(list);
      setUpdMsg(list.length ? t('%s update(s) available', list.length) : t('All plugins are up to date.'));
    }).catch(() => setUpdMsg(t('Update check failed.')));
  }

  const shown = plugins
    .filter((p) => (filter === 'inactive' ? p.enabled === false : true))
    .filter((p) => (t(p.name) + ' ' + t(p.description || '')).toLowerCase().includes(iq.trim().toLowerCase()));
  const selectableIds = plugins.length > 1 ? shown.map((p) => p.id) : [];
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggleOne(id) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() { setSelected(allSelected ? new Set() : new Set(selectableIds)); }
  function applyBulk() {
    const ids = [...selected];
    if (!bulk || !ids.length) return;
    if (bulk === 'remove' && !window.confirm(t('Remove %s plugin(s)? This deletes them and rebuilds.', ids.length))) return;
    setErr(''); setBusy(t(VERB[bulk]) + ' ' + t('%s plugin(s)…', ids.length));
    apiFetch('/api/plugins/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: bulk, ids }) })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setBusy(''); setErr(d.error || t('failed')); return; }
        if (d.errors && d.errors.length) setErr(d.errors.join(' · '));
        if (d.rebuilt) { setBusy(t('Done. Reloading…')); window.location.reload(); }
        else { setBusy(''); setSelected(new Set()); setBulk(''); if (onChanged) onChanged(); }
      })
      .catch(() => { setBusy(''); setErr(t('request failed')); });
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
            <TextInput maxW="18rem" value={iq} onChange={(e) => setIq(e.target.value)} placeholder={t('Search installed plugins…')} spellCheck="false" />
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

      <Box borderWidth="1px" borderColor="ui.border" borderRadius="forge" bg="ui.surface" boxShadow="sm" overflow="hidden">
        {shown.map((p) => {
          const up = upFor(p.id);
          const active = p.enabled !== false;
          // No tool is "core" — every one is a normal plugin. Lock actions only to
          // avoid an empty app: can't remove the only tool, can't deactivate the
          // only active one.
          const soleInstalled = plugins.length <= 1;
          const soleActive = active && (plugins.length - inactiveCount) <= 1;
          return (
            <Flex key={p.id} align="center" gap="4" px="5" py="4" transition="background .14s ease" opacity={active ? 1 : 0.6} borderTopWidth="1px" borderColor="ui.border" _first={{ borderTopWidth: '0' }} _hover={{ bg: 'ui.sunk' }} flexWrap={{ base: 'wrap', md: 'nowrap' }}>
              {selectableIds.length > 0 && (soleInstalled
                ? <Box w="1.25rem" flex="none" aria-hidden="true" />
                : <Checkbox checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} aria-label={t('Select %s', p.name)} />)}
              <Flex display="grid" placeItems="center" w="2.5rem" h="2.5rem" flex="none" borderRadius="forge" color="white" bg={active ? 'navy' : 'ui.muted'} css={{ '& svg': { width: '1.25rem', height: '1.25rem' } }}><ToolIcon name={p.icon} size={20} /></Flex>
              <Box flex="1" minW="0">
                <HStack gap="2">
                  <chakra.h3 m="0" fontSize="0.9375rem" fontWeight="600" color="ui.heading" letterSpacing="-.01em">{t(p.name)}</chakra.h3>
                  {soleInstalled && <Badge variant="subtle" textTransform="uppercase" fontSize="0.625rem" color="ui.muted" bg="ui.tagbg">{t('Only plugin')}</Badge>}
                  {!active && <Badge variant="subtle" textTransform="uppercase" fontSize="0.625rem" color="ui.muted" bg="ui.tagbg">{t('Inactive')}</Badge>}
                  {up && <Badge bg="navy" color="white" fontSize="0.625rem">{t('Update available')}</Badge>}
                </HStack>
                <Text mt="1" fontSize="0.8125rem" color="ui.muted" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">{t(p.description)}</Text>
                <Text mt="1.5" fontSize="0.6875rem" color="ui.muted">{t('Version %s', p.version)} · {t('By %s', p.author || t('unknown'))} · {p.price === 'free' ? t('Free') : p.price}</Text>
              </Box>
              <Flex gap="2" flex="none" align="center" w={{ base: 'full', md: 'auto' }} pl={{ base: 'calc(2.75rem + 1rem)', md: '0' }}>
                {up && <Button variant="primary" size="sm" disabled={!!busy} onClick={() => updateOne(p.id, p.name)}>{t('Update to %s', up.latest)}</Button>}
                {active && <Button variant="ghost" size="sm" onClick={() => onOpen(p.id)}>{t('Open')}</Button>}
                {(!active || !soleActive) && <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => toggle(p.id, !active)}>{active ? t('Deactivate') : t('Activate')}</Button>}
                {!soleInstalled && <Button variant="ghost" size="sm" danger disabled={!!busy} onClick={() => remove(p.id, p.name)}>{t('Remove')}</Button>}
              </Flex>
            </Flex>
          );
        })}
        {shown.length === 0 && <Box px="5" py="12" textAlign="center" color="ui.muted" fontSize="0.875rem">{t('No plugins match.')}</Box>}
      </Box>
    </>
  );
}
