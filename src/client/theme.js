// Chakra UI v3 design system for Forge. Maps the UnleashWP brand + the existing
// light/dark surface/text palette to Chakra tokens, so components style
// themselves with semantic tokens (`ui.surface`, `ui.heading`, …) that adapt to
// colour mode automatically. JS (no TypeScript); no typegen needed.
import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

const config = defineConfig({
  globalCss: {
    'html, body': { fontFamily: 'body', background: 'ui.bg', color: 'ui.text' },
    // Make navy the default colour palette, so every Chakra component that
    // resolves `colorPalette.*` (tab indicators, badges, focus rings, …) is
    // navy unless a call site overrides it — instead of Chakra's grey default.
    html: { colorPalette: 'brand' },
    // Accessibility: one consistent navy keyboard-focus ring for everything the
    // user can Tab to (buttons, links, inputs, tabs, icon buttons, …), so the
    // focus is always visible and on-brand instead of the browser's default.
    '*:focus-visible': { outline: '2px solid', outlineColor: 'ui.primary', outlineOffset: '2px' },
  },
  theme: {
    // Match the old SCSS mq() breakpoints so responsive props line up.
    breakpoints: { sm: '560px', md: '640px', lg: '780px', xl: '1280px', '2xl': '1536px' },
    tokens: {
      colors: {
        navy: { value: '#203159' },
        navyDeep: { value: '#0f131f' },
        navy2: { value: '#2a3f6f' },
        yellow: { value: '#fcbe00' },
        slate: { value: '#727f9f' },
        slate2: { value: '#35415b' },
        // Brand palette (navy) — powers colorPalette="brand" on Chakra components.
        brand: {
          50: { value: '#eef1f6' },
          100: { value: '#d7dded' },
          200: { value: '#b0bcd6' },
          300: { value: '#8496bd' },
          400: { value: '#5d6f9f' },
          500: { value: '#3c4e7d' },
          600: { value: '#2a3b64' },
          700: { value: '#203159' },
          800: { value: '#1a2747' },
          900: { value: '#141d35' },
          950: { value: '#0f131f' },
        },
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
        // brand colorPalette sub-tokens (what Chakra's recipes resolve). These
        // MUST be nested under `brand` — flat 'brand.solid' keys collide with
        // the `brand` token scale above and never emit their CSS vars, which
        // makes colorPalette="brand" fall back to Chakra's grey default.
        brand: {
          solid: { value: { base: '{colors.brand.700}', _dark: '{colors.brand.400}' } },
          contrast: { value: '#ffffff' },
          fg: { value: { base: '{colors.brand.700}', _dark: '{colors.brand.300}' } },
          muted: { value: { base: '{colors.brand.100}', _dark: '{colors.brand.900}' } },
          subtle: { value: { base: '{colors.brand.50}', _dark: '{colors.brand.950}' } },
          emphasized: { value: { base: '{colors.brand.200}', _dark: '{colors.brand.800}' } },
          focusRing: { value: { base: '{colors.brand.600}', _dark: '{colors.brand.400}' } },
        },
        'ui.bg': { value: { base: '#eef1f6', _dark: '#0a0e16' } },
        'ui.surface': { value: { base: '#ffffff', _dark: '#141a27' } },
        'ui.sunk': { value: { base: '#f5f7fa', _dark: '#1b2231' } },
        'ui.border': { value: { base: '#e3e7f0', _dark: '#2b3446' } },
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
        'ui.ghostHover': { value: { base: 'rgba(32,49,89,.06)', _dark: 'rgba(124,147,255,.12)' } },
        'ui.ring': { value: { base: 'rgba(32,49,89,.26)', _dark: 'rgba(124,147,255,.42)' } },
        'ui.rangeFill': { value: { base: '#e7ebf5', _dark: '#26314d' } },
      },
      shadows: {
        sm: { value: { base: '0 1px 2px rgba(32,49,89,.06)', _dark: '0 1px 2px rgba(0,0,0,.4)' } },
        md: { value: { base: '0 6px 24px rgba(32,49,89,.09)', _dark: '0 6px 24px rgba(0,0,0,.4)' } },
        lg: { value: { base: '0 18px 48px rgba(32,49,89,.16)', _dark: '0 18px 48px rgba(0,0,0,.55)' } },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
