import type { ComponentProps } from 'react';
import type Feather from '@expo/vector-icons/Feather';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

/** Feather names (lucide, the web's icons, was forked from Feather): the app's icon vocabulary. */
export type IconName = ComponentProps<typeof Feather>['name'];

/**
 * Each Feather name used by the app, drawn with the system's icons: SF Symbols on iOS and Material
 * Symbols on Android (`expo-symbols`). A name without an entry falls back to the Feather glyph.
 */
export const SYSTEM_ICONS: Partial<Record<IconName, { sf: SFSymbol; md: AndroidSymbol }>> = {
  'file-text': { sf: 'doc.text', md: 'description' },
  briefcase: { sf: 'briefcase', md: 'work' },
  users: { sf: 'person.2', md: 'group' },
  inbox: { sf: 'tray', md: 'inbox' },
  user: { sf: 'person.crop.circle', md: 'account_circle' },
  home: { sf: 'building.2', md: 'home' },
  'book-open': { sf: 'book', md: 'menu_book' },
  layout: { sf: 'rectangle.grid.1x2', md: 'dashboard' },
  grid: { sf: 'square.grid.2x2', md: 'grid_view' },
  'help-circle': { sf: 'questionmark.circle', md: 'help' },
  'chevron-right': { sf: 'chevron.right', md: 'chevron_right' },
  check: { sf: 'checkmark', md: 'check' },
  x: { sf: 'xmark', md: 'close' },
  eye: { sf: 'eye', md: 'visibility' },
  'eye-off': { sf: 'eye.slash', md: 'visibility_off' },
  info: { sf: 'info.circle', md: 'info' },
  'check-circle': { sf: 'checkmark.circle', md: 'check_circle' },
  'alert-triangle': { sf: 'exclamationmark.triangle', md: 'warning' },
  'wifi-off': { sf: 'wifi.slash', md: 'wifi_off' },
  'user-plus': { sf: 'person.badge.plus', md: 'person_add' },
  star: { sf: 'star', md: 'star' },
  mail: { sf: 'envelope', md: 'mail' },
  'log-out': { sf: 'rectangle.portrait.and.arrow.right', md: 'logout' },
  'log-in': { sf: 'arrow.right.circle', md: 'login' },
  award: { sf: 'rosette', md: 'workspace_premium' },
};
