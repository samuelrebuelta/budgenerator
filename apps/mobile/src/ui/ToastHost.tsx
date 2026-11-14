import { useEffect } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dismissToast, toastStore, type ToastTone } from '@bg/app-core/toast';
import { colors, nativeShadows, spacing } from '@bg/ui-tokens';
import { bindStore } from '../state/bindStore';
import { GlassSurface } from './GlassSurface';
import { Icon, type IconName } from './Icon';
import { useNativeLook } from './platform';
import { Text } from './Text';
import { shapes, systemColors } from './theme';

const useToastStore = bindStore(toastStore);

const toneStyle: Record<ToastTone, { line: string; ink: string; icon: IconName }> = {
  info: { line: colors['info-line'], ink: colors['info-ink'], icon: 'info' },
  success: { line: colors['success-line'], ink: colors['success-ink'], icon: 'check-circle' },
  warning: { line: colors['warning-line'], ink: colors['warning-ink'], icon: 'alert-triangle' },
  error: { line: colors['danger-line'], ink: colors['danger-ink'], icon: 'wifi-off' },
};

/**
 * Space above the bottom inset for the tab bar, so the toast sits on top of it (§6.1): the
 * floating Liquid Glass bar on iOS and the 80 dp Material 3 navigation bar on Android.
 */
const TAB_BAR_CLEARANCE = Platform.OS === 'android' ? 88 : 64;

/**
 * Renders the app-wide toast of `@bg/app-core` (`showToast`, and the BG-012 offline toast that
 * the mutation guard shows), like the web's `ToastHost`, and announces it to VoiceOver/TalkBack.
 */
export function ToastHost() {
  const toast = useToastStore((state) => state.toast);
  const insets = useSafeAreaInsets();
  const look = useNativeLook();

  useEffect(() => {
    if (toast)
      AccessibilityInfo.announceForAccessibility(
        toast.title ? `${toast.title}. ${toast.message}` : toast.message,
      );
  }, [toast]);

  if (!toast) return null;
  const offline = toast.id.startsWith('offline-');
  const tone = toneStyle[toast.tone];
  const urgent = toast.tone === 'error' || toast.tone === 'warning';
  return (
    <View
      pointerEvents="box-none"
      style={[styles.overlay, { bottom: insets.bottom + TAB_BAR_CLEARANCE }]}
    >
      <GlassSurface
        testID={offline ? 'offline-mutation-toast' : 'app-toast'}
        accessibilityRole={urgent ? 'alert' : 'summary'}
        accessibilityLiveRegion={urgent ? 'assertive' : 'polite'}
        style={[styles.toast, look !== 'glass' && [styles.solid, { borderColor: tone.line }]]}
      >
        <Icon name={offline ? 'wifi-off' : tone.icon} size={18} color={tone.ink} />
        <View style={styles.texts}>
          {toast.title ? (
            <Text variant="label" weight="semibold" style={{ color: tone.ink }}>
              {toast.title}
            </Text>
          ) : null}
          <Text variant="label" weight="regular" style={{ color: tone.ink }}>
            {toast.message}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar aviso"
          hitSlop={8}
          android_ripple={{ color: systemColors.ripple, borderless: true, radius: 24 }}
          onPress={() => dismissToast(toast.id)}
          style={styles.close}
        >
          <Icon name="x" size={16} color={tone.ink} />
        </Pressable>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: spacing[4], right: spacing[4], alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingLeft: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: shapes.card,
    borderCurve: 'continuous',
  },
  // Glass draws its own depth; the solid fallback keeps the web toast's border and shadow.
  solid: { borderWidth: 1, ...nativeShadows.toast },
  texts: { flex: 1, paddingVertical: spacing[1] },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
