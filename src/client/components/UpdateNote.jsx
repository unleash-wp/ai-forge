// Non-blocking "update available" note (free, via GitHub Releases). Never
// downloads code - just links the release notes.
import { useState, useEffect } from 'react';
import { Box, Link, Text } from '@chakra-ui/react';
import { apiFetch } from '../core.jsx';

export default function UpdateNote() {
  const [updates, setUpdates] = useState([]);
  useEffect(() => {
    apiFetch('/api/updates').then((r) => r.json()).then((d) => setUpdates(d.updates || [])).catch(() => {});
  }, []);
  if (!updates.length) return null;
  return (
    <Box bg="rgba(252,190,0,.12)" border="1px solid" borderColor="rgba(252,190,0,.45)" color="ui.text"
      borderRadius="forge" px="3.5" py="2.5" fontSize="0.875rem" mb="6">
      {updates.map((u) => (
        <Text as="div" key={u.id}>Update available: <b>{u.name}</b> {u.current} → {u.latest}. <Link href={u.url} target="_blank" rel="noopener" color="ui.primary" fontWeight="600">Release notes</Link></Text>
      ))}
    </Box>
  );
}
