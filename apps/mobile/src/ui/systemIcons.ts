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
  lock: { sf: 'lock', md: 'lock' },
  plus: { sf: 'plus', md: 'add' },
  minus: { sf: 'minus', md: 'remove' },
  'plus-circle': { sf: 'plus.circle', md: 'add_circle' },
  'trash-2': { sf: 'trash', md: 'delete' },
  share: { sf: 'square.and.arrow.up', md: 'share' },
  link: { sf: 'link', md: 'link' },
  copy: { sf: 'doc.on.doc', md: 'content_copy' },
  'more-horizontal': { sf: 'ellipsis', md: 'more_horiz' },
  list: { sf: 'list.bullet', md: 'list' },
  'check-square': { sf: 'checklist', md: 'checklist' },
  search: { sf: 'magnifyingglass', md: 'search' },
  'rotate-ccw': { sf: 'arrow.counterclockwise', md: 'undo' },
  'cloud-off': { sf: 'icloud.slash', md: 'cloud_off' },
  cloud: { sf: 'checkmark.icloud', md: 'cloud_done' },
  'arrow-up': { sf: 'arrow.up', md: 'arrow_upward' },
  'arrow-down': { sf: 'arrow.down', md: 'arrow_downward' },
  'edit-3': { sf: 'pencil', md: 'edit' },
  circle: { sf: 'circle', md: 'radio_button_unchecked' },
  tool: { sf: 'wrench.and.screwdriver', md: 'construction' },
  calendar: { sf: 'calendar', md: 'calendar_today' },
  'trending-up': { sf: 'chart.line.uptrend.xyaxis', md: 'trending_up' },
  folder: { sf: 'folder', md: 'folder' },
  clipboard: { sf: 'checklist.checked', md: 'assignment_turned_in' },
  slash: { sf: 'nosign', md: 'block' },
};
