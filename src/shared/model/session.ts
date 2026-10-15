let uid: string | null = null;
let revision = 0;
export function setSessionUid(next: string | null) {
  uid = next;
  revision += 1;
}
export function sessionUid() {
  return uid;
}
export function sessionRevision() {
  return revision;
}
export function isSessionCurrent(expected: string, version: number) {
  return uid === expected && version === revision;
}
export async function withTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                'La conexión está tardando demasiado. Comprueba la red y vuelve a intentarlo.',
              ),
            ),
          ms,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
