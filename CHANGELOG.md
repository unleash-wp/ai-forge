# Changelog

All notable changes to UnleashWP AI Forge are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [0.3.1] — unreleased

**Why you should update:** 0.3.0 exposed the browser UI and the self-update path
without an authentication gate. If you ever ran `uwp serve` on anything other
than loopback, update before doing so again.

### Security
- `serve` now requires `UWP_FORGE_TOKEN` before it will accept a non-loopback
  bind, instead of relaxing the bind first and authenticating after ([#6](https://github.com/unleash-wp/ai-forge/issues/6)).
- Plugin install paths are validated and self-update is gated behind auth, so an
  install source can no longer write outside the plugin directory ([#20](https://github.com/unleash-wp/ai-forge/issues/20), [#21](https://github.com/unleash-wp/ai-forge/issues/21)).
- GitHub token targets are rejected when the host is not the expected API origin,
  so a redirect cannot walk a token to a third party ([#14](https://github.com/unleash-wp/ai-forge/issues/14)).
- A community plugin can no longer register under a shipped tool's name and take
  its identity, and a plugin marked "Inactive" is now genuinely inactive.

### Added
- Community plugins can ship a browser panel, not just MCP tools.
- WP Forge Mirror documented in the product family table.

### Fixed
- The MCP layer no longer applies a blanket wordpress.org gate; each field
  degrades on its own, so one unavailable source stops one field rather than the
  whole response.
- Private fetches carry timeouts, so a hanging upstream cannot stall a request
  indefinitely.
- Milestone URL encoding is aligned between the changelog tool and the GitHub
  API, with a test asserting the raw form is gone rather than only that the
  encoded form is present ([#15](https://github.com/unleash-wp/ai-forge/issues/15), [#16](https://github.com/unleash-wp/ai-forge/issues/16)).

### Changed
- Contributors plugin shares a `Pager` and `EntityDetail` component instead of
  duplicating both.
- Outward-facing prose no longer uses em dashes ([#18](https://github.com/unleash-wp/ai-forge/issues/18), [#19](https://github.com/unleash-wp/ai-forge/issues/19)).

## [0.3.0] — 2026-07-28

First release with the MCP server, browser UI and zero-dependency CLI in one
package. See the [GitHub releases](https://github.com/unleash-wp/ai-forge/releases)
for 0.1.0 through 0.3.0; entries before 0.3.1 were not kept in this file.

[Unreleased]: https://github.com/unleash-wp/ai-forge/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/unleash-wp/ai-forge/releases/tag/v0.3.0
