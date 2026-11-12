import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { useAuthStore } from '@/entities/auth';
import { resendVerificationEmail } from '@/entities/auth';
import { Button } from '@/shared/ui';

/**
 * Shown while the account email is not verified. Publishing the estimator and
 * saving its settings require a verified email (Rules and Functions).
 */
export function EmailVerificationNotice({ reason }: { reason?: string }) {
  const emailVerified = useAuthStore((s) => s.emailVerified);
  const email = useAuthStore((s) => s.user?.email ?? '');
  const refreshVerification = useAuthStore((s) => s.refreshVerification);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'checking' | 'pending'>(
    'idle',
  );
  const [error, setError] = useState('');
  if (emailVerified) return null;

  const resend = async () => {
    setStatus('sending');
    setError('');
    try {
      await resendVerificationEmail();
      setStatus('sent');
    } catch {
      setStatus('idle');
      setError('No se ha podido enviar el email. Espera unos minutos y vuelve a intentarlo.');
    }
  };

  const check = async () => {
    setStatus('checking');
    setError('');
    try {
      const verified = await refreshVerification();
      setStatus(verified ? 'idle' : 'pending');
    } catch {
      setStatus('idle');
      setError('No se ha podido comprobar. Revisa tu conexión.');
    }
  };

  return (
    <div
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6"
      role="status"
      data-testid="email-verification-notice"
    >
      <div className="flex items-center gap-2 mb-1">
        <MailCheck size={16} className="text-amber-700" />
        <span className="font-semibold text-sm text-amber-800">Verifica tu email</span>
      </div>
      <p className="text-sm text-amber-800 mb-3">
        Te hemos enviado un enlace a {email || 'tu email'}.{' '}
        {reason ?? 'Lo necesitas para publicar el estimador y proteger tu cuenta.'}
      </p>
      {status === 'sent' && (
        <p className="text-sm text-amber-800 mb-2">Enviado. Revisa también la carpeta de spam.</p>
      )}
      {status === 'pending' && (
        <p className="text-sm text-amber-800 mb-2">
          Todavía no consta como verificado. Abre el enlace del email y vuelve a comprobarlo.
        </p>
      )}
      {error && (
        <p className="field-error mb-2" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" loading={status === 'checking'} onClick={() => void check()}>
          Ya lo he verificado
        </Button>
        <Button variant="ghost" loading={status === 'sending'} onClick={() => void resend()}>
          Reenviar email
        </Button>
      </div>
    </div>
  );
}
