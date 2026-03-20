/**
 * App Theme - Peak Transit reference (dark grey, green, blue, red)
 */

export const COLORS = {
  // Dark theme backgrounds (ss1 reference: #1C2023 charcoal)
  background: '#1C2023',
  backgroundSecondary: '#2C2C2C',
  surface: '#363B42',
  surfaceLight: '#40464D',

  // Sidebar & bottom bar
  navBarBackground: '#545454',
  navBarSeparator: '#535353',
  navBarText: '#B0B0B0',
  navBarIcon: '#000',
  navBarIconDisabled: 'rgba(241,242,246,0.35)',

  // Sidebar only - exact from screenshot (header lighter, items darker, light separators)
  sidebarHeaderBg: '#575757',
  sidebarItemBg: '#484848',
  sidebarSeparator: '#686868',
  sidebarProceed: '#30AD4F',
  sidebarBorder: '#282828',
  sidebarTextIcon: '#FFFFFF',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#B8BCC4',
  textMuted: '#8A8E96',

  // Status colors (gauge: green → yellow → orange → red)
  onTime: '#22C55E',
  early: '#EAB308',
  late: '#F97316',
  emergency: '#EF4444',

  // Gauge gradient (ss2): Late (orange-red) at start → On Time (green) at middle → Early (orange-red) at end
  // Arc: start lower-left (Late) → top (On Time) → end lower-right (Early)
  gaugeGradient: [
    '#EA580C', '#F97316', '#FB923C', '#FBBF24', '#EAB308', '#84CC16',
    '#22C55E', '#16A34A', '#22C55E', '#84CC16', '#EAB308', '#FBBF24',
    '#FB923C', '#F97316', '#EA580C',
  ],

  // Accents
  primary: '#22C55E', // Green - Proceed if Safe, On Time
  primaryDark: '#16A34A',
  accentBlue: '#2563EB', // Cancel, checkmarks, Select Driver
  accentOrange: '#F97316',

  // Header / branding
  headerBlue: '#1E3A8A',

  // PIN/Login screen (light)
  pinBackground: '#F8FAFC',
  pinSurface: '#FFFFFF',
  pinText: '#1E293B',
  pinTextMuted: '#64748B',
  pinBorder: '#E2E8F0',
  keypadBackground: '#E8ECF0',
  keyBackground: '#FFFFFF',
};
