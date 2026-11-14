import {defineTheme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral';

/*
 * DHA "Winter" colour system — an analogous cool palette (blue-grey → ice → pine) laid out
 * with Material 3 colour roles and the 60-30-10 rule. Contrast is kept soft on purpose:
 * no pure white surfaces and no near-black ink, only enough for WCAG AA text (≥ 4.5:1).
 *
 *   KEY (60%)       Frost  #EEF2F5  canvas; cards are snow #F8FAFB, lines #DCE3E9.
 *   SECONDARY (30%) Ice    #E1E8EE  secondary buttons, chips, segmented controls.
 *   PRIMARY (10%)   Winter blue #567594  main buttons, selected tab, progress, key numbers.
 *   TERTIARY        Pine   #5E8C84  sparing highlights (streak badges).
 *   INK             Slate navy #2E3A46 instead of black; soft ink #66727F.
 * Dark mode is a "winter night": #1C2530 canvas with frosted blue #A9C6E2 actions.
 * Elevation: borderless cards lifted by a soft, blue-tinted two-layer shadow (no hard lines).
 * (The theme keeps its old `sky` slug so existing imports keep working.)
 */
const FROST = {canvas: '#EEF2F5', card: '#F8FAFB', line: '#DCE3E9', ink: '#2E3A46', inkSoft: '#66727F'};
// Dark mode lifted after on-device review: lighter slate surfaces, clearer card/canvas separation.
const NIGHT = {canvas: '#1C2530', card: '#27323E', popover: '#2E3A47', line: '#384654', ink: '#EEF3F7', inkSoft: '#B0BDC9'};
const ICE = {light: '#E1E8EE', dark: '#34424F', ink: '#3E5163', inkDark: '#D3DEE8'};
const WINTER_BLUE = {light: '#567594', dark: '#A9C6E2', text: '#4A6884', on: '#FFFFFF', onDark: '#13202C'};
const PINE = {bg: '#DCEAE7', bgDark: '#1F3330', ink: '#2F5C55', inkDark: '#A9D2CA', line: '#5E8C84'};

export const skyTheme = defineTheme({
  name: 'sky',
  extends: neutralTheme,
  color: {accent: [WINTER_BLUE.light, WINTER_BLUE.dark], neutralStyle: 'cool', contrast: 'standard'},
  typography: {
    scale: {base: 16, ratio: 1.2},
    body: {
      family: 'IBM Plex Sans KR',
      fallbacks: '"Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif',
    },
    heading: {
      family: 'IBM Plex Sans KR',
      fallbacks: '"Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif',
      weight: 'bold',
      weights: {1: 'bold', 2: 'bold', 3: 'bold'},
    },
  },
  radius: {base: 4, multiplier: 2.25},
  motion: {tempo: 0.9, character: 'expressive'},
  tokens: {
    // 60% — key colour family (Frost)
    '--color-background-body': [FROST.canvas, NIGHT.canvas],
    '--color-background-card': [FROST.card, NIGHT.card],
    '--color-background-surface': [FROST.card, NIGHT.card],
    '--color-background-popover': [FROST.card, NIGHT.popover],
    '--color-border': [FROST.line, NIGHT.line],
    '--color-text-primary': [FROST.ink, NIGHT.ink],
    '--color-text-secondary': [FROST.inkSoft, NIGHT.inkSoft],
    '--color-icon-primary': [FROST.ink, NIGHT.ink],
    '--color-icon-secondary': [FROST.inkSoft, NIGHT.inkSoft],
    // 30% — secondary (Ice)
    '--color-neutral': [ICE.light, ICE.dark],
    '--color-background-gray': [ICE.light, ICE.dark],
    '--color-text-gray': [ICE.ink, ICE.inkDark],
    '--color-border-gray': ['#9AAAB8', '#4E5D6B'],
    '--color-track': ['#D5DEE6', '#3F4D5B'],
    // 10% — primary (Winter blue)
    '--color-accent': [WINTER_BLUE.light, WINTER_BLUE.dark],
    '--color-on-accent': [WINTER_BLUE.on, WINTER_BLUE.onDark],
    '--color-text-accent': [WINTER_BLUE.text, WINTER_BLUE.dark],
    '--color-icon-accent': [WINTER_BLUE.light, WINTER_BLUE.dark],
    '--color-accent-muted': ['#5675941F', '#9DB8D326'],
    '--color-background-muted': ['#E3EBF2', '#2A3848'],
    // "done" states use pine instead of a saturated green, so completion stays in the winter family
    '--color-success': ['#4F8077', '#7FB5AB'],
    '--color-success-muted': ['#4F807729', '#7FB5AB33'],
    '--color-text-green': [PINE.ink, PINE.inkDark],
    '--color-background-green': [PINE.bg, PINE.bgDark],
    // tertiary — Pine highlights (Token/Badge "orange" slot)
    '--color-background-orange': [PINE.bg, PINE.bgDark],
    '--color-text-orange': [PINE.ink, PINE.inkDark],
    // Elevation — tinted with slate navy, never pure black, so it reads as cold light.
    '--shadow-low': [
      '0 1px 2px rgba(46, 58, 70, 0.05), 0 4px 14px -6px rgba(46, 58, 70, 0.10)',
      '0 1px 2px rgba(0, 0, 0, 0.25), 0 6px 16px -8px rgba(0, 0, 0, 0.35)',
    ],
    '--color-border-orange': [PINE.line, PINE.line],
    '--color-icon-orange': [PINE.line, PINE.inkDark],
  },
  components: {
    card: {
      base: {borderWidth: '0', boxShadow: 'var(--shadow-low)'},
    },
    button: {
      base: {fontWeight: 'var(--font-weight-semibold)'},
    },
  },
});
