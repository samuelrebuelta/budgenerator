import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export interface SpikeStep {
  name: string;
  ok: boolean;
  ms: number;
  detail: string;
}

export interface SpikeResult {
  spike: string;
  platform: string;
  ok: boolean;
  startedAt: string;
  steps: SpikeStep[];
}

/** Collects timed steps, logs them with a `[spike]` prefix (Metro) and saves a JSON report. */
export class SpikeRecorder {
  private readonly steps: SpikeStep[] = [];
  private readonly startedAt = new Date().toISOString();

  constructor(private readonly spike: string) {}

  async step<T>(name: string, run: () => Promise<T> | T, describe?: (value: T) => string) {
    const started = performance.now();
    try {
      const value = await run();
      const detail = describe ? describe(value) : 'ok';
      this.push({ name, ok: true, ms: performance.now() - started, detail });
      return value;
    } catch (error) {
      const detail =
        error instanceof Error
          ? `${error.name}: ${error.message}${error.stack ? ` | ${error.stack.split('\n').slice(1, 6).join(' <- ')}` : ''}`
          : String(error);
      this.push({ name, ok: false, ms: performance.now() - started, detail });
      throw error;
    }
  }

  /** Records a check without throwing, so later steps still run. */
  check(name: string, ok: boolean, detail: string) {
    this.push({ name, ok, ms: 0, detail });
  }

  private push(step: SpikeStep) {
    this.steps.push(step);
    // eslint-disable-next-line no-console -- development spike output, read from Metro
    console.log(
      `[spike] ${this.spike} · ${step.ok ? 'OK ' : 'ERR'} ${step.name} (${step.ms.toFixed(1)} ms) ${step.detail}`,
    );
  }

  async finish(): Promise<SpikeResult> {
    const result: SpikeResult = {
      spike: this.spike,
      platform: `${Platform.OS} ${String(Platform.Version)}`,
      ok: this.steps.every((step) => step.ok),
      startedAt: this.startedAt,
      steps: this.steps,
    };
    const directory = new Directory(Paths.document, 'spikes');
    if (!directory.exists) directory.create({ intermediates: true });
    const file = new File(directory, `${this.spike}-${Platform.OS}.json`);
    await file.write(JSON.stringify(result, null, 2));
    // eslint-disable-next-line no-console -- development spike output, read from Metro
    console.log(`[spike] ${this.spike} · ${result.ok ? 'GO' : 'FALLO'} · ${file.uri}`);
    return result;
  }
}
