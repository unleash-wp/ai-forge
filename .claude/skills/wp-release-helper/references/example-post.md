# Example release post — structure reference

A real "What's in WordPress 7.1 Beta 3?" post. Use it as the shape/tone target.
Note how every claim maps to a linked PR/ticket and the two source links match
the CLI's **Sources** block. Do not copy its wording — regenerate from the CLI
data for the actual window.

---

**What's in WordPress 7.1 Beta 3?**

For technical details on the more than 71 issues addressed since Beta 1, see the
following links:

- [Closed 7.1 WordPress Core Trac tickets](https://core.trac.wordpress.org/query?status=closed&changetime=07/15/2026..07/22/2026&milestone=7.1&group=component&col=id&col=milestone&col=owner&col=type&col=priority&order=id) since July 15, 2026
- [7.1 Gutenberg commits](https://github.com/WordPress/gutenberg/commits/wp/7.1?since=2026-07-15&until=2026-07-22) since July 15, 2026

Note: Beta 2 was released on July 17, 2026, as part of the WordPress 7.0.2
release and includes important security fixes.

Beta 3 introduces two improvements to styling. Applying local style changes
globally is no longer an all-or-nothing action. The
[Apply globally](https://github.com/WordPress/gutenberg/pull/79839) option in the
block inspector now opens a quick review step, allowing you to choose which
modified styles to apply globally while keeping the rest as local overrides.

Other notable fixes include improvements to media uploads: long animated GIF
uploads no longer hang, images rotated using EXIF metadata are processed
correctly, and uploading a single HEIC image in Safari no longer creates two
entries.

The editor also includes additional fixes for Notes, responsive styling, and
custom CSS. For developers, WordPress Coding Standards has been updated to
version 3.4.0.

Unicode email address support will not be included in WordPress 7.1. The work
will continue in a community plugin.

---

## Why this maps cleanly to the CLI output

- The **count line** ("more than 71 issues since Beta 1") = CLI `coreTickets` +
  `gutenbergPRs` for the window.
- The **two links** = the CLI **Sources** block verbatim.
- "Apply globally" = a Gutenberg `[Feature]` PR (#79839) in the CLI list.
- The media-upload sentences = individual Core/Gutenberg fixes (GIF hang, EXIF
  rotation, HEIC double-entry) — each a real PR/ticket title.
- "Coding Standards 3.4.0" = Core changeset with its ticket.
- The Unicode-email note is editorial context the coordinator adds — outside the
  data; include only when the user provides it.
