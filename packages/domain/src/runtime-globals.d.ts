/**
 * Web-standard globals the domain relies on, declared without the DOM lib so that browser-only
 * APIs (window, document, canvas, storage) fail to type-check here. Each platform must provide
 * them at runtime: browsers and Node 24 do; React Native (Hermes) needs a check or polyfill for
 * `structuredClone`, `URL`/`URLSearchParams` and `TextDecoder` (BC3 import stays web-only).
 * This file only applies to the package's own typecheck; the web build uses the DOM lib.
 */
declare function structuredClone<T>(value: T): T;

declare class TextEncoder {
  encode(input?: string): Uint8Array;
}

declare class TextDecoder {
  constructor(label?: string, options?: { fatal?: boolean });
  decode(input?: Uint8Array): string;
}

declare class URLSearchParams {
  constructor(init?: Record<string, string> | string);
  get(name: string): string | null;
  getAll(name: string): string[];
  keys(): IterableIterator<string>;
  toString(): string;
}

declare class URL {
  constructor(url: string, base?: string);
  readonly origin: string;
  readonly protocol: string;
  readonly hostname: string;
  readonly username: string;
  readonly password: string;
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
  readonly searchParams: URLSearchParams;
}

// `var` (not `let`) so that it is also visible as `globalThis.crypto`.
// eslint-disable-next-line no-var
declare var crypto: { randomUUID?: () => string } | undefined;
