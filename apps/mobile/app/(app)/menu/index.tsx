import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radii, spacing } from '@bg/ui-tokens';
import { useAuthStore } from '../../../src/state/stores';
import { Icon, Screen, Text } from '../../../src/ui';
import { MENU_SECTIONS } from '../../../src/navigation/menu';

export default function MenuScreen() {
  const email = useAuthStore((state) => state.user?.email ?? '');
  return (
    <Screen edges={['bottom']}>
      {email ? (
        <Text variant="label" tone="muted" weight="regular">
          {email}
        </Text>
      ) : null}
      <View style={styles.list}>
        {MENU_SECTIONS.map((section, index) => (
          <Pressable
            key={section.id}
            accessibilityRole="button"
            accessibilityLabel={section.title}
            onPress={() =>
              router.push(
                section.id === 'account'
                  ? '/menu/account'
                  : { pathname: '/menu/[section]', params: { section: section.id } },
              )
            }
            style={({ pressed }) => [
              styles.row,
              index > 0 && styles.divider,
              pressed && styles.pressed,
            ]}
          >
            <Icon name={section.icon} size={20} color={colors['ink-soft']} />
            <Text style={styles.title}>{section.title}</Text>
            <Icon name="chevron-right" size={16} color={colors['ink-subtle']} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  pressed: { backgroundColor: colors['surface-muted'] },
  title: { flex: 1 },
});
