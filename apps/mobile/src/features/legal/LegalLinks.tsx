import { StyleSheet, View } from 'react-native';
import { spacing } from '@bg/ui-tokens';
import { openLegalDocument, type LegalDocumentId } from '../../platform/webLinks';
import { Text } from '../../ui';

const LINKS: { id: LegalDocumentId; label: string }[] = [
  { id: 'privacidad', label: 'Privacidad' },
  { id: 'condiciones', label: 'Condiciones' },
  { id: 'aviso-legal', label: 'Aviso legal' },
  { id: 'cookies', label: 'Cookies' },
];

/** Same links as the web's `LegalLinks`, opened on the web in the system browser. */
export function LegalLinks() {
  return (
    <View style={styles.row} accessibilityLabel="Textos legales">
      {LINKS.map((link) => (
        <Text
          key={link.id}
          variant="caption"
          tone="muted"
          accessibilityRole="link"
          accessibilityHint="Se abre en el navegador"
          onPress={() => void openLegalDocument(link.id)}
          style={styles.link}
        >
          {link.label}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: spacing[4],
    rowGap: spacing[1],
  },
  link: { textDecorationLine: 'underline', paddingVertical: spacing[2] },
});
