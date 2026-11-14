import { useState } from 'react';
import { Share, Link as LinkIcon, X } from 'lucide-react';
import { useAuthStore } from '@/entities/auth';
import { revokeSharedBudget, shareBudget, useActiveBudgetRecord } from '@/entities/budget';
import { useProfileStore } from '@/entities/profile';
import { EmailVerificationNotice } from '@/features/account';
import { toUserMessage } from '@/shared/lib';
import { Button, ConfirmModal } from '@/shared/ui';
import { withTimeout } from '@/shared/model/session';
export function ShareButton() {
  const budget = useActiveBudgetRecord();
  const company = useProfileStore((s) => s.profile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState<{ token: string; url: string } | null>(null);
  const [revoke, setRevoke] = useState(false);
  const refreshVerification = useAuthStore((s) => s.refreshVerification);
  const [needsVerification, setNeedsVerification] = useState(false);
  const publish = async () => {
    if (busy || !budget) return;
    setBusy(true);
    setError('');
    try {
      // Rules read `email_verified` from the ID token, which can lag behind `user.emailVerified`
      // after verifying in another tab. Sharing is rare and online-only, so always refresh.
      if (!(await refreshVerification())) {
        setNeedsVerification(true);
        return;
      }
      const token = await withTimeout(shareBudget(budget, company));
      const url = `${location.origin}/shared/${token}`;
      setLink({ token, url });
      if (navigator.share)
        await navigator.share({ title: company.name || 'Presupuesto · budgenerator', url });
      else await navigator.clipboard.writeText(url);
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError'))
        setError(
          toUserMessage(e, {
            fallback: 'No se ha podido compartir el presupuesto.',
            permissionDenied:
              'No se ha podido crear el enlace. Comprueba que tu email está verificado y vuelve a intentarlo.',
          }),
        );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      {needsVerification && (
        <EmailVerificationNotice reason="Hasta entonces no podrás crear enlaces públicos." />
      )}
      <Button variant="secondary" onClick={() => void publish()} loading={busy}>
        <Share size={16} />
        {busy ? 'Preparando…' : 'Crear enlace público'}
      </Button>
      {link && (
        <div className="mt-3 text-xs text-gray-500 space-y-2 max-w-sm">
          <p>Enlace de esta versión · válido durante 30 días.</p>
          <div className="flex gap-3 items-center">
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 underline inline-flex items-center gap-1"
            >
              <LinkIcon size={13} />
              Abrir enlace
            </a>
            <Button
              variant="link"
              size="sm"
              onClick={() => setRevoke(true)}
              className="gap-1 text-xs text-danger-ink"
            >
              <X size={13} />
              Revocar
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <ConfirmModal
        open={revoke}
        onClose={() => setRevoke(false)}
        title="¿Revocar este enlace?"
        message="Dejará de estar disponible para cualquier persona que lo tenga."
        confirmLabel="Revocar enlace"
        onConfirm={async () => {
          if (link) await revokeSharedBudget(link.token);
          setLink(null);
          setRevoke(false);
        }}
      />
    </div>
  );
}
