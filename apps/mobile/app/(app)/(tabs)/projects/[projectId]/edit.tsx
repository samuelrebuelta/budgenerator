import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { colors, spacing } from '@bg/ui-tokens';
import { useProjectMutation } from '../../../../../src/features/projects/mutations';
import { validateProjectMetadata } from '../../../../../src/features/projects/team';
import { useProjectStore } from '../../../../../src/state/stores';
import { Button, Card, Notice, Text, TextField } from '../../../../../src/ui';

/**
 * «Editar nombre y cliente» (web project metadata dialog) as a native sheet. Same checks and
 * messages as the web; the shared transaction `updateProjectMetadata` also updates the source
 * budget (address and client), and the store syncs the budget list. Blocked offline (BG-012 toast).
 */
export default function EditProjectSheet() {
  const { projectId = '' } = useLocalSearchParams<{ projectId: string }>();
  const project = useProjectStore((state) =>
    state.activeProject?.id === projectId ? state.activeProject : null,
  );
  const [title, setTitle] = useState(project?.title ?? '');
  const [clientName, setClientName] = useState(project?.clientName ?? '');
  const [validation, setValidation] = useState('');
  const { busy, error, setError, run } = useProjectMutation();

  const save = () => {
    const message = validateProjectMetadata(title, clientName);
    setValidation(message);
    setError('');
    if (message || !project) return;
    void run(
      'project:metadata',
      async () => {
        await useProjectStore
          .getState()
          .updateProjectMetadata(projectId, title.trim(), clientName.trim());
        router.back();
      },
      { feedback: 'success', fallback: 'No se han podido actualizar los datos del proyecto.' },
    );
  };

  const message = validation || error;

  return (
    <KeyboardAwareScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
      testID="project-edit-sheet"
    >
      <Text tone="muted">Los cambios también se reflejarán en el presupuesto de origen.</Text>
      <Card style={styles.card}>
        <TextField
          label="Nombre del proyecto"
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          autoCapitalize="sentences"
          editable={!busy}
          returnKeyType="next"
          testID="project-edit-title"
        />
        <TextField
          label="Nombre del cliente"
          value={clientName}
          onChangeText={setClientName}
          maxLength={120}
          autoCapitalize="words"
          editable={!busy}
          returnKeyType="done"
          onSubmitEditing={save}
          testID="project-edit-client"
        />
      </Card>
      {message ? (
        <Notice tone="danger" plain testID="project-edit-error">
          {message}
        </Notice>
      ) : null}
      <Button
        label="Guardar cambios"
        fullWidth
        disabled={!project || !!busy}
        loading={busy === 'project:metadata'}
        onPress={save}
        testID="project-edit-save"
      />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[12] },
  card: { gap: spacing[3] },
});
