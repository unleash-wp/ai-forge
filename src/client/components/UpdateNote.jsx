// Non-blocking "update available" note (free, via GitHub Releases). Never
// downloads code - just links the release notes.
import { useState, useEffect } from 'react';

export default function UpdateNote() {
  const [updates, setUpdates] = useState([]);
  useEffect(() => {
    fetch('/api/updates').then((r) => r.json()).then((d) => setUpdates(d.updates || [])).catch(() => {});
  }, []);
  if (!updates.length) return null;
  return (
    <div className="c-warn">
      {updates.map((u) => (
        <div key={u.id}>Update available: <b>{u.name}</b> {u.current} → {u.latest}. <a href={u.url} target="_blank" rel="noopener">Release notes</a></div>
      ))}
    </div>
  );
}
