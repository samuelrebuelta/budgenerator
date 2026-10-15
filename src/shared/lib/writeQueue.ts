import { registerFlusher, syncStatus } from '@/shared/model/sync';
interface Entry<T> {
  value: T;
  revision: number;
  timer?: ReturnType<typeof setTimeout>;
  running?: Promise<void>;
  cancelled?: boolean;
}
/** Coalesce by document, serialize requests, retain failed values for explicit retry. */
export class WriteQueue<T> {
  private entries = new Map<string, Entry<T>>();
  private namespace: string;
  private write: (key: string, value: T) => Promise<void>;
  private delay: number;
  constructor(namespace: string, write: (key: string, value: T) => Promise<void>, delay = 700) {
    this.namespace = namespace;
    this.write = write;
    this.delay = delay;
    registerFlusher(() => this.flush());
  }
  schedule(key: string, value: T) {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { value, revision: 0 };
      this.entries.set(key, entry);
    }
    entry.value = value;
    entry.revision += 1;
    clearTimeout(entry.timer);
    syncStatus(this.namespace + key, true);
    entry.timer = setTimeout(() => {
      void this.run(key, entry!).catch(() => {});
    }, this.delay);
  }
  private async run(key: string, entry: Entry<T>): Promise<void> {
    clearTimeout(entry.timer);
    if (entry.running) return entry.running;
    if (entry.cancelled || this.entries.get(key) !== entry) return;
    entry.running = (async () => {
      try {
        let written: number;
        do {
          written = entry.revision;
          await this.write(key, entry.value);
        } while (!entry.cancelled && written !== entry.revision);
        if (this.entries.get(key) === entry) {
          this.entries.delete(key);
          syncStatus(this.namespace + key, false);
        }
      } catch (error) {
        if (!entry.cancelled) syncStatus(this.namespace + key, false, error);
        throw error;
      } finally {
        entry.running = undefined;
      }
    })();
    return entry.running;
  }
  async flush() {
    await Promise.all([...this.entries].map(([key, entry]) => this.run(key, entry)));
  }
  async cancel(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.cancelled = true;
    clearTimeout(entry.timer);
    await entry.running?.catch(() => {});
    this.entries.delete(key);
    syncStatus(this.namespace + key, false);
  }
  clear() {
    for (const [key, entry] of this.entries) {
      entry.cancelled = true;
      clearTimeout(entry.timer);
      syncStatus(this.namespace + key, false);
    }
    this.entries.clear();
  }
}
