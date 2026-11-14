import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '@bg/ui-tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

const palette: Record<NoticeTone, { surface: string; line: string; ink: string; icon: IconName }> =
  {
    info: {
      surface: colors['info-surface'],
      line: colors['info-line'],
      ink: colors['info-ink'],
      icon: 'info',
    },
    success: {
      surface: colors['success-surface'],
      line: colors['success-line'],
      ink: colors['success-ink'],
      icon: 'check-circle',
    },
    warning: {
      surface: colors['warning-surface'],
      line: colors['warning-line'],
      ink: colors['warning-ink'],
      icon: 'alert-triangle',
    },
    danger: {
      surface: colors['danger-surface'],
      line: colors['danger-line'],
      ink: colors['danger-ink'],
      icon: 'alert-triangle',
    },
  };

export interface NoticeProps {
  tone?: NoticeTone;
  title?: string;
  icon?: IconName;
  /** `plain` is the web's inline `Alert plain`: text only, no box. */
  plain?: boolean;
  children?: ReactNode;
  testID?: string;
}

/** Equivalent of the web's `Alert`: errors are announced (`alert`), the rest are `status`-like. */
export function Notice({
  tone = 'info',
  title,
  icon,
  plain = false,
  children,
  testID,
}: NoticeProps) {
  const style = palette[tone];
  return (
    <View
      testID={testID}
      accessibilityRole={tone === 'danger' ? 'alert' : 'summary'}
      accessibilityLiveRegion={tone === 'danger' ? 'assertive' : 'polite'}
      style={[
        styles.box,
        plain ? styles.plain : { backgroundColor: style.surface, borderColor: style.line },
      ]}
    >
      {title ? (
        <View style={styles.titleRow}>
          <Icon name={icon ?? style.icon} size={16} color={style.ink} />
          <Text variant="label" weight="semibold" style={{ color: style.ink }}>
            {title}
          </Text>
        </View>
      ) : null}
      {typeof children === 'string' ? (
        <Text variant="label" weight="regular" style={{ color: style.ink }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing[4],
    gap: spacing[2],
  },
  plain: { borderWidth: 0, padding: 0, backgroundColor: 'transparent' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
});
