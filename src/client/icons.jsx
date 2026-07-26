// Shared iconography via RemixIcon (tree-shakeable SVG components, currentColor).
// A plugin declares an icon keyword in its plugin.json ("icon": "sparkling");
// ToolIcon resolves it, falling back to a plug icon for unknown names. Keeping a
// curated keyword map (rather than free-form icon names) keeps the bundle small
// and gives contributors a stable, documented palette.
import {
  RiCodeSSlashLine, RiGitCommitLine, RiArticleLine, RiFileList3Line,
  RiSparklingLine, RiMagicLine, RiToolsLine, RiRocketLine,
  RiTerminalBoxLine, RiPaletteLine, RiPlugLine, RiFlashlightLine, RiApps2Line,
  RiArrowLeftSLine, RiArrowRightSLine, RiCalendar2Line, RiHome5Line,
  RiMenuLine, RiSettings3Line,
} from '@remixicon/react';

const MAP = {
  code: RiCodeSSlashLine,
  'git-commit': RiGitCommitLine,
  changelog: RiGitCommitLine,
  article: RiArticleLine,
  list: RiFileList3Line,
  sparkling: RiSparklingLine,
  magic: RiMagicLine,
  tools: RiToolsLine,
  rocket: RiRocketLine,
  terminal: RiTerminalBoxLine,
  palette: RiPaletteLine,
  plug: RiPlugLine,
  flash: RiFlashlightLine,
};

export const ICON_NAMES = Object.keys(MAP);

export function ToolIcon({ name, size = 20 }) {
  const Ic = MAP[name] || RiPlugLine;
  return <Ic size={size} />;
}

export const PluginsIcon = RiApps2Line;
export const HomeIcon = RiHome5Line;
export const BurgerIcon = RiMenuLine;
export const SettingsIcon = RiSettings3Line;
export const ArrowLeft = RiArrowLeftSLine;
export const ArrowRight = RiArrowRightSLine;
export const CalendarIcon = RiCalendar2Line;
