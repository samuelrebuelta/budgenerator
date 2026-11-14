import { router } from 'expo-router';
import { useAuthStore } from '../../../src/state/stores';
import { ListGroup, ListRow, Screen, Text } from '../../../src/ui';
import { MENU_SECTIONS } from '../../../src/navigation/menu';
import { menuOnGlass } from '../../../src/navigation/options';

export default function MenuScreen() {
  const email = useAuthStore((state) => state.user?.email ?? '');
  return (
    <Screen edges={['bottom']} transparent={menuOnGlass}>
      {email ? (
        <Text variant="label" tone="muted" weight="regular">
          {email}
        </Text>
      ) : null}
      <ListGroup>
        {MENU_SECTIONS.map((section) => (
          <ListRow
            key={section.id}
            title={section.title}
            icon={section.icon}
            onPress={() =>
              router.push(
                section.id === 'account'
                  ? '/menu/account'
                  : { pathname: '/menu/[section]', params: { section: section.id } },
              )
            }
          />
        ))}
      </ListGroup>
    </Screen>
  );
}
