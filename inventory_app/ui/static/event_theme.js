export const DEFAULT_EVENT_ACCENT = '#4F8CFF';

export function normalizeHexColor(value, fallback = DEFAULT_EVENT_ACCENT) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;

  const withHash = raw.startsWith('#') ? raw : `#${raw}`;
  const upper = withHash.toUpperCase();
  return /^#[0-9A-F]{6}$/.test(upper) ? upper : fallback;
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}

function mixHex(baseHex, targetHex, targetWeight) {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  const weight = Math.max(0, Math.min(1, Number(targetWeight) || 0));
  const baseWeight = 1 - weight;
  return rgbToHex({
    r: base.r * baseWeight + target.r * weight,
    g: base.g * baseWeight + target.g * weight,
    b: base.b * baseWeight + target.b * weight,
  });
}

function channelToLinear(channel) {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * channelToLinear(r)) + (0.7152 * channelToLinear(g)) + (0.0722 * channelToLinear(b));
}

function pickOnAccent(hex) {
  return relativeLuminance(hex) > 0.42 ? '#08111F' : '#F8FBFF';
}

export function summarizePipeTags(value) {
  const tokens = String(value || '')
    .split('|')
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => token !== 'ALL');

  if (!tokens.length) return 'No event tags defined yet.';
  if (tokens.length <= 4) return tokens.join(' · ');
  return `${tokens.slice(0, 4).join(' · ')} +${tokens.length - 4}`;
}

export function applyEventTheme(hex, target = document.documentElement) {
  const accent = normalizeHexColor(hex);
  const { r, g, b } = hexToRgb(accent);
  const accentSoft = mixHex(accent, '#FFFFFF', 0.72);
  const accentBorder = mixHex(accent, '#FFFFFF', 0.2);
  const accentDeep = mixHex(accent, '#0F172A', 0.28);
  const accentSurface = mixHex(accent, '#0F172A', 0.82);
  const onAccent = pickOnAccent(accent);

  target.style.setProperty('--event-accent', accent);
  target.style.setProperty('--event-accent-rgb', `${r} ${g} ${b}`);
  target.style.setProperty('--event-accent-soft', accentSoft);
  target.style.setProperty('--event-accent-border', accentBorder);
  target.style.setProperty('--event-accent-deep', accentDeep);
  target.style.setProperty('--event-accent-surface', accentSurface);
  target.style.setProperty('--event-on-accent', onAccent);

  return {
    accent,
    accentSoft,
    accentBorder,
    accentDeep,
    accentSurface,
    onAccent,
  };
}