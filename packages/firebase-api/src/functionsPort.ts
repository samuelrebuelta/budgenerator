/**
 * Minimal Cloud Functions surface (callables) for the shared repositories (BG-014 D2). The
 * platform binds its Functions instance, created in `europe-southwest1` like
 * `FUNCTION_REGION` in functions/src/core/config.ts:
 *
 * - web: `(name, options) => httpsCallable(functions, name, options)` (`firebase/functions`);
 * - mobile: the same with `@react-native-firebase/functions`.
 */
export interface CallableOptionsLike {
  /** Milliseconds before the client gives up (both SDKs default to 70 s). */
  readonly timeout?: number;
}

export type CallableLike<Request, Response> = (data?: Request) => Promise<{ data: Response }>;

export interface FunctionsPort {
  httpsCallable<Request = unknown, Response = unknown>(
    name: string,
    options?: CallableOptionsLike,
  ): CallableLike<Request, Response>;
}
