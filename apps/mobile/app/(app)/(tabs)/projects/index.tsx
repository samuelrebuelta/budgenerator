import { useProjectStore } from '../../../../src/state/stores';
import { Screen, Text } from '../../../../src/ui';

export default function ProjectsScreen() {
  const count = useProjectStore((state) => state.projects.length);
  return (
    <Screen edges={[]}>
      <Text tone="muted" testID="projects-placeholder">
        {count === 1 ? 'Tienes 1 proyecto.' : `Tienes ${count} proyectos.`} La lista llegará en la
        siguiente entrega de la fase 1.
      </Text>
    </Screen>
  );
}
