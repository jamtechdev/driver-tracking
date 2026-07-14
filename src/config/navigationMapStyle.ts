/**
 * Light + dark themes for Google Maps–style turn-by-turn navigation.
 */

export type NavigationColorScheme = 'light' | 'dark';

export interface NavigationHudTheme {
  scheme: NavigationColorScheme;
  /** Overlay / map fallback background */
  canvas: string;
  /** Blue direction banner (same in both modes — Google keeps this bright) */
  banner: string;
  bannerText: string;
  bannerMuted: string;
  /** Speed + compass chips */
  chipBg: string;
  chipBorder: string;
  chipShadow: string;
  speedValue: string;
  speedUnit: string;
  compassFace: string;
  compassInner: string;
  compassRing: string;
  compassSouth: string;
  compassHubStroke: string;
  /** Bottom ETA sheet */
  sheetBg: string;
  sheetPrimary: string;
  sheetSecondary: string;
  eta: string;
  exitBg: string;
  exitText: string;
  error: string;
  /** Map stop labels */
  stopLabelBg: string;
  stopLabelText: string;
  stopLabelBorder: string;
  stopLabelCurrentBorder: string;
}

export const NAV_HUD_LIGHT: NavigationHudTheme = {
  scheme: 'light',
  canvas: '#E8EAED',
  banner: '#1A73E8',
  bannerText: '#FFFFFF',
  bannerMuted: 'rgba(255,255,255,0.85)',
  chipBg: '#FFFFFF',
  chipBorder: 'rgba(60,64,67,0.16)',
  chipShadow: '#000',
  speedValue: '#202124',
  speedUnit: '#5F6368',
  compassFace: '#FFFFFF',
  compassInner: '#F8F9FA',
  compassRing: 'rgba(60,64,67,0.18)',
  compassSouth: '#9AA0A6',
  compassHubStroke: '#5F6368',
  sheetBg: '#FFFFFF',
  sheetPrimary: '#202124',
  sheetSecondary: '#5F6368',
  eta: '#188038',
  exitBg: '#EA4335',
  exitText: '#FFFFFF',
  error: '#C5221F',
  stopLabelBg: '#FFFFFF',
  stopLabelText: '#202124',
  stopLabelBorder: 'rgba(60,64,67,0.15)',
  stopLabelCurrentBorder: 'rgba(234, 67, 53, 0.5)',
};

export const NAV_HUD_DARK: NavigationHudTheme = {
  scheme: 'dark',
  canvas: '#0F172A',
  banner: '#1A73E8',
  bannerText: '#FFFFFF',
  bannerMuted: 'rgba(255,255,255,0.85)',
  chipBg: '#1F2937',
  chipBorder: 'rgba(148,163,184,0.28)',
  chipShadow: '#000',
  speedValue: '#F8FAFC',
  speedUnit: '#94A3B8',
  compassFace: '#1F2937',
  compassInner: '#111827',
  compassRing: 'rgba(148,163,184,0.35)',
  compassSouth: '#64748B',
  compassHubStroke: '#94A3B8',
  sheetBg: '#111827',
  sheetPrimary: '#F8FAFC',
  sheetSecondary: '#94A3B8',
  eta: '#4ADE80',
  exitBg: '#EF4444',
  exitText: '#FFFFFF',
  error: '#FCA5A5',
  stopLabelBg: 'rgba(17, 24, 39, 0.94)',
  stopLabelText: '#F8FAFC',
  stopLabelBorder: 'rgba(148,163,184,0.3)',
  stopLabelCurrentBorder: 'rgba(248, 113, 113, 0.7)',
};

export function getNavigationHudTheme(scheme: NavigationColorScheme | null | undefined): NavigationHudTheme {
  return scheme === 'dark' ? NAV_HUD_DARK : NAV_HUD_LIGHT;
}

/** Day map — default Google-like light styling. */
export const NAVIGATION_MAP_STYLE_LIGHT = [
  { elementType: 'geometry', stylers: [{ color: '#E8EEF5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }, { weight: 3 }] },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#CBD5E1' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry.fill',
    stylers: [{ color: '#DCE5F0' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#D7E8D4' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#D4DEEA' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#475569' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.fill',
    stylers: [{ color: '#B9D8B4' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#FFFFFF' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#C5D0DE' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#1E293B' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#FDE68A' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#F59E0B' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#78350F' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#D0DAE6' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#A8C8EC' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3B6EA5' }],
  },
];

/** Night map — readable dark Google-like styling (not pitch black). */
export const NAVIGATION_MAP_STYLE_DARK = [
  { elementType: 'geometry', stylers: [{ color: '#1B2434' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#CBD5E1' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0F172A' }, { weight: 2.5 }] },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#334155' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry.fill',
    stylers: [{ color: '#243044' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#1A2A22' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#2A3648' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94A3B8' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.fill',
    stylers: [{ color: '#1C3328' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#3B4660' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1E293B' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#E2E8F0' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#4B5A78' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#334155' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#F8FAFC' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#2C3A50' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0B1A2E' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748B' }],
  },
];

export function getNavigationMapStyle(scheme: NavigationColorScheme | null | undefined) {
  return scheme === 'dark' ? NAVIGATION_MAP_STYLE_DARK : NAVIGATION_MAP_STYLE_LIGHT;
}

/** @deprecated Prefer NAVIGATION_MAP_STYLE_LIGHT */
export const NAVIGATION_PREMIUM_MAP_STYLE = NAVIGATION_MAP_STYLE_LIGHT;
/** @deprecated Prefer NAVIGATION_MAP_STYLE_DARK */
export const NAVIGATION_PREMIUM_DARK_STYLE = NAVIGATION_MAP_STYLE_DARK;
