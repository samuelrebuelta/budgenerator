export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const dismissKey = 'budgenerator:install-dismissed';
export function createInstallController() {
  let state = {
    canPrompt: false,
    installed: false,
    standalone: false,
    dismissed: false,
    pending: false,
  };
  let event: InstallPromptEvent | null = null;
  let started = false;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<typeof state>) => {
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn());
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start: () => {
      if (started) return;
      started = true;
      const media = window.matchMedia('(display-mode: standalone)');
      let dismissed = false;
      try {
        dismissed = sessionStorage.getItem(dismissKey) === '1';
      } catch {
        /* Private browsing. */
      }
      update({
        dismissed,
        standalone:
          media.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone,
      });
      media.addEventListener('change', () => update({ standalone: media.matches }));
      window.addEventListener('beforeinstallprompt', (raw) => {
        raw.preventDefault();
        event = raw as InstallPromptEvent;
        update({ canPrompt: true });
      });
      window.addEventListener('appinstalled', () => {
        event = null;
        update({ installed: true, canPrompt: false, pending: false });
      });
    },
    dismiss: () => {
      try {
        sessionStorage.setItem(dismissKey, '1');
      } catch {
        /* Private browsing. */
      }
      update({ dismissed: true });
    },
    install: async () => {
      const current = event;
      if (!current || state.pending) return;
      event = null;
      update({ canPrompt: false, pending: true });
      try {
        await current.prompt();
        const choice = await current.userChoice;
        if (choice.outcome === 'accepted') update({ installed: true });
      } catch {
        /* The browser menu instructions remain available. */
      } finally {
        update({ pending: false });
      }
    },
  };
}
export const pwaInstall = createInstallController();
