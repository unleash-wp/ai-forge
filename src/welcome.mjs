// Branded first-run / no-args screen for the CLI, so `ai-forge` reads as a piece
// of UnleashWP software the moment it runs — not a bare help dump. Zero-dependency
// ANSI (truecolor brand navy #203159 + yellow #fcbe00); degrades to plain text
// when stdout isn't a TTY (pipes, CI, logs).
import { existsSync } from 'node:fs';
import { VERSION } from './version.mjs';
import { tokenPath } from './connectors/github-token.mjs';
import { resolveCookie } from './connectors/wporg-cookie.mjs';

const tty = !!process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (open, s) => (tty ? `\x1b[${open}m${s}\x1b[0m` : s);
const navyBar = (s) => (tty ? `\x1b[48;2;32;49;89m\x1b[38;2;255;255;255m\x1b[1m${s}\x1b[0m` : s);
const yellow = (s) => wrap('1;38;2;252;190;0', s);
const white = (s) => wrap('1;38;2;255;255;255', s);
const dim = (s) => wrap('2', s);
const green = (s) => wrap('38;2;46;160;67', s);
const cyan = (s) => wrap('38;2;120;180;230', s);
const bold = (s) => wrap('1', s);

export function renderWelcome() {
  const ghSet = !!process.env.GITHUB_TOKEN || existsSync(tokenPath());
  const wpSet = !!resolveCookie();
  const dot = (ok) => (ok ? green('●') : dim('○'));
  const state = (ok) => (ok ? green('connected') : dim('optional'));

  return [
    '',
    '  ' + navyBar('  ◆ UnleashWP  ') + '  ' + yellow('AI Forge') + '   ' + dim('v' + VERSION),
    '  ' + dim('The AI tool for WordPress.'),
    '',
    '  ' + dot(true) + ' ' + white('Node ' + process.version) + '   ' + dot(true) + ' ' + white('uwp-ai-forge ready'),
    '  ' + dot(ghSet) + ' GitHub ' + state(ghSet) + '   ' + dot(wpSet) + ' WordPress.org ' + state(wpSet),
    '',
    '  ' + bold('Open the app') + dim('  — visual setup + tools, no flags to remember'),
    '    ' + cyan('uwp-ai-forge serve') + dim('   → http://localhost:4321'),
    '',
    '  ' + bold('Use it from your AI') + dim('  — Claude Code / Codex'),
    '    ' + cyan('claude mcp add uwp-ai-forge -- npx -y @unleashwp/ai-forge@latest mcp'),
    '',
    '  ' + bold('Make a changelog now'),
    '    ' + cyan('uwp-ai-forge changelog --since <date> --until <date> --milestone <x.y> --post'),
    '',
    '  ' + dim('uwp-ai-forge -h for all commands  ·  short alias: uwp  ·  unleash-wp.com'),
    '',
  ].join('\n');
}
