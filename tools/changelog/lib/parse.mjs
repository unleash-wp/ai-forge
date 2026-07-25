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

  // A single commit can close several tickets in one clause: "Fixes #100, #101
  // and #102." Capture the whole comma/and-separated list after the keyword, then
  // pull every number - the old "keyword + one #id" regex dropped all but the
  // first, undercounting tickets.
  const idList = (keyword) => {
    const out = [];
    const clause = new RegExp('\\b(?:' + keyword + ')\\s+(#\\d+(?:\\s*(?:,|and|&)\\s*#\\d+)*)', 'gi');
    for (const m of msg.matchAll(clause)) for (const n of m[1].matchAll(/#(\d+)/g)) out.push(Number(n[1]));
    return out;
  };
  const tickets = idList('Fix|Fixes|Fixed|Close|Closes|Closed');
  const seeTickets = idList('See');

  const csMatch = msg.match(/git-svn-id:\s*\S+@(\d+)/) || msg.match(/(?:trunk|branches\/[\d.]+)@(\d+)/);
  const changeset = csMatch ? Number(csMatch[1]) : null;

  const propsMatch = msg.match(/^Props[:\s]+([^.]+)\.?\s*$/im);
  const props = propsMatch
    ? propsMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // The human description: everything after the subject minus the machine
  // trailers (Props / Fixes / See / Merges / git-svn-id / sign-offs). This is
  // the "better detail" the GitHub commit carries that the ticket list doesn't.
  const body = msg.split('\n').slice(1)
    .filter((ln) => !/^\s*(Props[:\s]|Unprops\b|Fix(?:e[sd])?\s+#|Clos(?:e[sd])?\s+#|See\s+#|Merges\s+\[|Reverts?\s+\[|git-svn-id:|Co-authored-by:|Signed-off-by:)/i.test(ln))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

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
    body,
  };
}
