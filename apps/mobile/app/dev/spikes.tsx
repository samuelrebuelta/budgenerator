import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { spacing } from '@bg/ui-tokens';
import { appVariant } from '../../src/platform/variant';
import { Button, Card, Screen, Text } from '../../src/ui';
import type { SpikeResult } from '../../src/dev/spikes/report';
import { runProjectRepositorySpike } from '../../src/dev/spikes/projectRepository';
import { runPdfSpike, sharePdf } from '../../src/dev/spikes/pdf';
import { runPersistenceProbe, runSessionResetSpike } from '../../src/dev/spikes/sessionReset';

type SpikeId = 'd2' | 'pdf' | 'd3' | 'persist-write' | 'persist-probe';

const RUNNERS: Record<SpikeId, { label: string; run: () => Promise<SpikeResult> }> = {
  d2: { label: 'D2 · Repositorio project con RNFB', run: runProjectRepositorySpike },
  pdf: { label: 'PDF en Hermes', run: runPdfSpike },
  d3: { label: 'D3 · Borrado al cambiar de cuenta', run: runSessionResetSpike },
  'persist-write': {
    label: 'D3 · Persistencia: escribir',
    run: () => runPersistenceProbe('write'),
  },
  'persist-probe': {
    label: 'D3 · Persistencia: leer tras reiniciar',
    run: () => runPersistenceProbe('probe'),
  },
};

/**
 * Phase 0 spikes (BG-014), development only: `budgenerator://dev/spikes?run=d2|pdf|d3|all&n=<nonce>`.
 * Results go to Metro (`[spike]`) and to Documents/spikes/*.json. Remove with the spikes'
 * follow-up in phase 1 (docs/specs/plans/2026-11-14-bg-014-spikes.md).
 */
export default function SpikesScreen() {
  if (appVariant !== 'development') return <Redirect href="/" />;
  return <SpikesPanel />;
}

function SpikesPanel() {
  // `n` (any nonce) lets the same spike run again from a new deep link.
  const { run, n } = useLocalSearchParams<{ run?: string; n?: string }>();
  const [results, setResults] = useState<SpikeResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [shareError, setShareError] = useState('');
  const started = useRef<string | undefined>(undefined);

  const execute = async (ids: SpikeId[]) => {
    setBusy(true);
    for (const id of ids) {
      const result = await RUNNERS[id].run();
      setResults((current) => [...current.filter((item) => item.spike !== result.spike), result]);
    }
    setBusy(false);
  };

  useEffect(() => {
    const key = `${run}:${n}`;
    if (!run || started.current === key) return;
    started.current = key;
    const ids: SpikeId[] =
      run === 'all' ? ['d2', 'pdf', 'd3'] : run in RUNNERS ? [run as SpikeId] : [];
    // Deferred so the effect itself does not set state (react-hooks/set-state-in-effect).
    if (ids.length) queueMicrotask(() => void execute(ids));
  }, [run, n]);

  return (
    <Screen title="Spikes fase 0">
      <Text tone="muted">Sólo development · emuladores demo-*</Text>
      {(Object.keys(RUNNERS) as SpikeId[]).map((id) => (
        <Button
          key={id}
          label={RUNNERS[id].label}
          disabled={busy}
          fullWidth
          onPress={() => void execute([id])}
        />
      ))}
      <Button
        label="Compartir PDF"
        variant="secondary"
        disabled={busy}
        fullWidth
        onPress={() => sharePdf().catch((error: Error) => setShareError(error.message))}
      />
      {shareError ? <Text tone="danger">{shareError}</Text> : null}
      {busy ? <Text tone="muted">Ejecutando…</Text> : null}
      {results.map((result) => (
        <Card key={result.spike} style={styles.card} testID={`spike-${result.spike}`}>
          <Text variant="label" weight="semibold" tone={result.ok ? undefined : 'danger'}>
            {result.ok ? 'GO' : 'FALLO'} · {result.spike} · {result.platform}
          </Text>
          {result.steps.map((step, index) => (
            <Text key={index} variant="caption" tone={step.ok ? 'muted' : 'danger'}>
              {step.ok ? '✓' : '✗'} {step.name} ({step.ms.toFixed(0)} ms): {step.detail}
            </Text>
          ))}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[1] },
});
