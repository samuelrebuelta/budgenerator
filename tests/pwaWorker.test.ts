import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it, expect, vi } from 'vitest';
function worker(failInstall = false) {
  const events: Record<string, (event: Record<string, unknown>) => void> = {};
  const entries = new Map<string, Map<string, Response>>();
  entries.set('another-app-cache', new Map());
  entries.set(
    'cimbra-shell-previous',
    new Map([['/assets/old-chunk.js', new Response('export const old=true;')]]),
  );
  const deleted: string[] = [];
  const caches = {
    keys: async () => [...entries.keys()],
    delete: async (key: string) => {
      deleted.push(key);
      return entries.delete(key);
    },
    open: async (key: string) => {
      if (!entries.has(key)) entries.set(key, new Map());
      const cache = entries.get(key)!;
      return {
        addAll: async (urls: string[]) => {
          if (failInstall) throw Error('network failed');
          for (const url of urls) cache.set(url, new Response(url));
        },
        match: async (url: string) => cache.get(url),
        put: async (url: string, response: Response) => {
          cache.set(url, response);
        },
      };
    },
  };
  const fetch = vi.fn(async () => {
    throw Error('offline');
  });
  const self = {
    location: { origin: 'https://example.test' },
    addEventListener: (name: string, callback: (event: Record<string, unknown>) => void) => {
      events[name] = callback;
    },
    clients: { claim: vi.fn(async () => {}) },
    skipWaiting: vi.fn(),
  };
  const source = readFileSync('public/sw.js', 'utf8')
    .replace('__CIMBRA_VERSION__', 'current')
    .replace(
      /\/\* __CIMBRA_PRECACHE__ \*\/\s*\[\]/,
      JSON.stringify(['/index.html', '/offline.html', '/assets/current.js']),
    );
  runInNewContext(source, {
    self,
    caches,
    fetch,
    Response,
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
  });
  const request = async (url: string, mode = 'cors') => {
    let response: Promise<Response> | undefined;
    events.fetch!({
      request: { url, method: 'GET', mode },
      respondWith: (value: Promise<Response>) => {
        response = value;
      },
    });
    return response;
  };
  const install = () => {
    let ready!: Promise<void>;
    events.install!({
      waitUntil: (value: Promise<void>) => {
        ready = value;
      },
    });
    return ready;
  };
  return { events, entries, deleted, self, request, install, fetch };
}
it('precaches atomically, serves a deep link offline and leaves Firebase requests alone', async () => {
  const w = worker();
  await w.install();
  expect(await (await w.request('https://example.test/templates/new', 'navigate'))?.text()).toBe(
    '/index.html',
  );
  expect(await w.request('https://firestore.googleapis.com/private')).toBeUndefined();
  expect(await w.request('https://example.test/__/auth/action', 'navigate')).toBeUndefined();
  expect(w.fetch).not.toHaveBeenCalled();
  expect(w.self.skipWaiting).not.toHaveBeenCalled();
});
it('retains a previous tab lazy chunk after activation', async () => {
  const w = worker();
  await w.install();
  expect(await (await w.request('https://example.test/assets/old-chunk.js'))?.text()).toContain(
    'old=true',
  );
});
it('removes an incomplete install without deleting another app cache', async () => {
  const w = worker(true);
  await expect(w.install()).rejects.toThrow('network failed');
  expect(w.deleted).toEqual(['cimbra-shell-current']);
  expect(w.entries.has('another-app-cache')).toBe(true);
  expect(w.entries.has('cimbra-shell-previous')).toBe(true);
});
it('returns a concrete offline response and activates only on explicit update', async () => {
  const w = worker();
  const response = await w.request('https://example.test/budgets', 'navigate');
  expect(response?.status).toBe(503);
  w.events.message!({ data: { type: 'SKIP_WAITING' } });
  expect(w.self.skipWaiting).toHaveBeenCalledOnce();
});
