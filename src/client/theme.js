// Chakra UI v3 design system for Forge. Maps the UnleashWP brand + the existing
// light/dark surface/text palette to Chakra tokens, so components style
// themselves with semantic tokens (`ui.surface`, `ui.heading`, …) that adapt to
// colour mode automatically. JS (no TypeScript); no typegen needed.
//
// preflight is off while the app is mid-migration from the hand-written SCSS —
// it stops Chakra's global reset from clobbering the not-yet-migrated BEM
// components. Flip it back on (drop the line) once the SCSS is fully removed.
import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

const config = defineConfig({
  preflight: false,
  globalCss: {
    'html, body': { fontFamily: 'body', background: 'ui.bg', color: 'ui.text' },
    // preflight is off, so add just the border reset Chakra components rely on
    // (makes `borderWidth` render without an explicit border-style). Low
    // specificity, so the SCSS components' own borders still win during the
    // migration.
    '*, *::before, *::after': { borderWidth: '0', borderStyle: 'solid', borderColor: 'ui.border' },
  },
  theme: {
    tokens: {
      colors: {
        navy: { value: '#203159' },
        navyDeep: { value: '#0f131f' },
        navy2: { value: '#2a3f6f' },
        yellow: { value: '#fcbe00' },
        slate: { value: '#727f9f' },
        slate2: { value: '#35415b' },
      },
      fonts: {
        heading: { value: '"Ubuntu", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
        body: { value: '"Ubuntu", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
      },
      radii: {
        forge: { value: '0.3125rem' },
      },
    },
    semanticTokens: {
      colors: {
        'ui.bg': { value: { base: '#eef1f6', _dark: '#0f1218' } },
        'ui.surface': { value: { base: '#ffffff', _dark: '#171b24' } },
        'ui.sunk': { value: { base: '#f5f7fa', _dark: '#1e232e' } },
        'ui.border': { value: { base: '#e3e7f0', _dark: '#2a3040' } },
        'ui.heading': { value: { base: '{colors.navy}', _dark: '#eaf0ff' } },
        'ui.text': { value: { base: '#2b3242', _dark: '#dbe2ef' } },
        'ui.muted': { value: { base: '#55607a', _dark: '#94a1bd' } },
        'ui.primary': { value: { base: '{colors.navy}', _dark: '#7c93ff' } },
        'ui.accent': { value: '{colors.yellow}' },
        'ui.tagbg': { value: { base: '#eceef5', _dark: '#232b40' } },
        'ui.tagfg': { value: { base: '{colors.navy}', _dark: '#b9c7ff' } },
        'ui.good': { value: '#1a8f57' },
        'ui.goodInk': { value: { base: '#157a45', _dark: '#4bd08a' } },
        'ui.bad': { value: '#c0392b' },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
