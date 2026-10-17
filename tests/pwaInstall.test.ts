import { afterEach, expect, it, vi } from 'vitest';
import { createInstallController, type InstallPromptEvent } from '../src/app/pwaInstall';
afterEach(() => vi.unstubAllGlobals());
function setup(standalone = false) {
  const target = new EventTarget();
  vi.stubGlobal(
    'window',
    Object.assign(target, {
      matchMedia: () => Object.assign(new EventTarget(), { matches: standalone }),
    }),
  );
  vi.stubGlobal('navigator', {
    standalone: false,
    userAgent: 'Test browser',
    platform: 'Linux',
    maxTouchPoints: 0,
  });
  vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: vi.fn() });
  const controller = createInstallController();
  controller.start();
  return { target, controller };
}
it('captures early prompts, consumes them once, and does not report cancellation as installed', async () => {
  const { target, controller } = setup();
  const prompt = vi.fn().mockResolvedValue(undefined);
  target.dispatchEvent(
    Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    }) as InstallPromptEvent,
  );
  expect(controller.getSnapshot().canPrompt).toBe(true);
  await controller.install();
  await controller.install();
  expect(prompt).toHaveBeenCalledTimes(1);
  expect(controller.getSnapshot()).toMatchObject({ canPrompt: false, installed: false });
  target.dispatchEvent(new Event('appinstalled'));
  expect(controller.getSnapshot().installed).toBe(true);
});
it('hides in standalone and remembers dismissal during this session', () => {
  const { controller } = setup(true);
  expect(controller.getSnapshot().standalone).toBe(true);
  controller.dismiss();
  expect(controller.getSnapshot().dismissed).toBe(true);
  expect(sessionStorage.setItem).toHaveBeenCalled();
});
it('recovers from a rejected prompt without reusing its event', async () => {
  const { target, controller } = setup();
  target.dispatchEvent(
    Object.assign(new Event('beforeinstallprompt'), {
      prompt: vi.fn().mockRejectedValue(Error('unavailable')),
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    }),
  );
  await controller.install();
  expect(controller.getSnapshot()).toMatchObject({
    canPrompt: false,
    pending: false,
    installed: false,
  });
});
