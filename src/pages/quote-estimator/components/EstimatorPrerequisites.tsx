import { useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { resendVerificationEmail, useAuthStore } from '@/entities/auth';
import { useProfileStore } from '@/entities/profile';
import { isValidPrivacyPolicyUrl, publishHostedPrivacyNotice } from '@/entities/quote-estimator';
import { missingRequirements } from '../model/estimatorSharing';
import { useEstimatorRequirements } from '../model/useEstimatorRequirements';
import { toUserMessage } from '@/shared/lib';
import { Alert, Button, Card, Input } from '@/shared/ui';

function Step({
  done,
  title,
  children,
}: {
  done: boolean;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      {done ? (
        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-success-ink" aria-hidden="true" />
      ) : (
        <Circle size={20} className="mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">
          {title}
          <span className="sr-only">{done ? ' (hecho)' : ' (pendiente)'}</span>
        </p>
        {!done && children && <div className="mt-2">{children}</div>}
      </div>
    </li>
  );
}

/**
 * What the public form needs before it can be published, completed here so the owner does not
 * lose the configuration by leaving the page.
 */
export function EstimatorPrerequisites() {
  const requirements = useEstimatorRequirements();
  const email = useAuthStore((state) => state.user?.email ?? '');
  const refreshVerification = useAuthStore((state) => state.refreshVerification);
  const profile = useProfileStore((state) => state.profile);
  const updateProfile = useProfileStore((state) => state.updateProfile);
  const saveProfile = useProfileStore((state) => state.saveProfile);
  const [name, setName] = useState(profile.name ?? '');
  const [privacyUrl, setPrivacyUrl] = useState(profile.privacyPolicyUrl ?? '');
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const run = async (label: string, action: () => Promise<string | void>) => {
    setWorking(label);
    setError('');
    setMessage('');
    try {
      const done = await action();
      if (done) setMessage(done);
    } catch (cause) {
      setError(toUserMessage(cause, 'No se ha podido guardar. Vuelve a intentarlo.'));
    } finally {
      setWorking('');
    }
  };

  const saveName = () =>
    run('name', async () => {
      if (!name.trim()) throw new Error('Escribe el nombre de tu empresa.');
      updateProfile({ name: name.trim() });
      await saveProfile();
    });

  const saveOwnPrivacyUrl = () =>
    run('privacy', async () => {
      if (!isValidPrivacyPolicyUrl(privacyUrl.trim()))
        throw new Error('Usa una dirección completa que empiece por https://');
      updateProfile({ privacyPolicyUrl: privacyUrl.trim() });
      await saveProfile();
    });

  const adoptHostedNotice = () =>
    run('hosted', async () => {
      if (!requirements.companyName) throw new Error('Guarda antes el nombre de tu empresa.');
      // The notice is built from the saved profile.
      await saveProfile();
      const { url } = await publishHostedPrivacyNotice();
      updateProfile({ privacyPolicyUrl: url });
      await saveProfile();
      return 'Aviso de privacidad creado con los datos de tu empresa.';
    });

  const checkEmail = () =>
    run('email', async () => {
      if (!(await refreshVerification()))
        throw new Error('Todavía no consta como verificado. Abre el enlace del email.');
    });

  const resend = () =>
    run('resend', async () => {
      await resendVerificationEmail();
      return 'Email enviado. Revisa también la carpeta de spam.';
    });

  const pending = missingRequirements(requirements).length;
  if (pending === 0) return null;
  return (
    <section aria-labelledby="estimator-requirements-heading" className="mb-6">
      <Card className="p-5 sm:p-6">
        <h2 id="estimator-requirements-heading" className="font-semibold text-gray-900">
          Antes de publicar
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {pending === 1 ? 'Te falta 1 paso' : `Te faltan ${pending} pasos`}. Puedes completarlos
          aquí mismo; lo que configures abajo se guarda mientras tanto.
        </p>
        <ol className="mt-4 space-y-4">
          <Step done={requirements.emailVerified} title="Email verificado">
            <p className="text-sm text-gray-600">
              Te enviamos un enlace a {email || 'tu email'} al registrarte.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => void checkEmail()}
                loading={working === 'email'}
              >
                Ya lo he verificado
              </Button>
              <Button variant="ghost" onClick={() => void resend()} loading={working === 'resend'}>
                Reenviar email
              </Button>
            </div>
          </Step>
          <Step done={requirements.companyName} title="Nombre de tu empresa">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Input
                id="estimator-company-name"
                label="Nombre que verán tus clientes"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Reformas García"
                className="sm:min-w-72"
              />
              <Button onClick={() => void saveName()} loading={working === 'name'}>
                Guardar nombre
              </Button>
            </div>
          </Step>
          <Step done={requirements.privacyNotice} title="Aviso de privacidad">
            <p className="text-sm text-gray-600">
              Tus clientes deben poder leer cómo tratas sus datos antes de enviarte una solicitud.
            </p>
            <div className="mt-3 rounded-lg border border-line bg-surface-muted p-3">
              <p className="text-sm font-medium text-gray-900">¿No tienes web?</p>
              <p className="mt-1 text-sm text-gray-600">
                Creamos un aviso de privacidad con los datos de tu empresa y lo publicamos por ti.
              </p>
              <Button
                className="mt-2"
                onClick={() => void adoptHostedNotice()}
                loading={working === 'hosted'}
                disabled={!requirements.companyName}
              >
                Usar el aviso de BudGenerator
              </Button>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <Input
                id="estimator-privacy-url"
                type="url"
                label="O la dirección del aviso de tu web"
                value={privacyUrl}
                onChange={(event) => setPrivacyUrl(event.target.value)}
                placeholder="https://tuempresa.es/privacidad"
                className="sm:min-w-72"
              />
              <Button
                variant="secondary"
                onClick={() => void saveOwnPrivacyUrl()}
                loading={working === 'privacy'}
              >
                Guardar dirección
              </Button>
            </div>
          </Step>
        </ol>
        <div className="mt-3 min-h-6" aria-live="polite">
          {message && (
            <p role="status" className="text-sm text-success-ink">
              {message}
            </p>
          )}
          {error && (
            <Alert tone="danger" plain>
              {error}
            </Alert>
          )}
        </div>
      </Card>
    </section>
  );
}
