// Turn a GitHub commit object into the fields a release post cares about.
//
// Gutenberg commit messages end their subject with the PR number: "... (#80287)".
// Core commits (mirrored from SVN in WordPress/wordpress-develop) carry:
//   - "Fixes #64932." / "Closes #123." -> closed Trac tickets
//   - "Props alice, bob."              -> real contributors
//   - "git-svn-id: .../trunk@62815 ..." -> changeset number r62815
export function parseCommit(c) {
  const msg = c.commit?.message || '';
  const subject = msg.split('\n')[0].trim();

  const prMatch = subject.match(/\(#(\d+)\)\s*$/);
  const pr = prMatch ? Number(prMatch[1]) : null;

  const tickets = [...msg.matchAll(/\b(?:Fix|Fixes|Fixed|Close|Closes|Closed)\s+#(\d+)/gi)].map((m) => Number(m[1]));
  const seeTickets = [...msg.matchAll(/\bSee\s+#(\d+)/gi)].map((m) => Number(m[1]));

  const csMatch = msg.match(/git-svn-id:\s*\S+@(\d+)/) || msg.match(/(?:trunk|branches\/[\d.]+)@(\d+)/);
  const changeset = csMatch ? Number(csMatch[1]) : null;

  const propsMatch = msg.match(/^Props[:\s]+([^.]+)\.?\s*$/im);
  const props = propsMatch
    ? propsMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return {
    sha: c.sha,
    shortSha: (c.sha || '').slice(0, 9),
    subject: subject.replace(/\s*\(#\d+\)\s*$/, ''),
    author: c.author?.login || c.commit?.author?.name || 'unknown',
    date: c.commit?.author?.date || null,
    url: c.html_url,
    pr,
    tickets: [...new Set(tickets)],
    seeTickets: [...new Set(seeTickets)],
    changeset,
    props,
  };
}
