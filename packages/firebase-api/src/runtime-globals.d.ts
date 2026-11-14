/**
 * Timers every platform provides (browsers, Node and Hermes), declared without the DOM or Node
 * libs so that browser-only APIs still fail to type-check in this package.
 */
declare function setTimeout(handler: () => void, timeout?: number): unknown;
declare function clearTimeout(id: unknown): void;
