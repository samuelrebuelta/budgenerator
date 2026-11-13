import { Mail, Phone, ShieldCheck } from 'lucide-react';
import type { PublicCompanyContact } from '@/entities/quote-estimator';
import { buttonClassName, Card } from '@/shared/ui';
import { Brand } from '@/shared/ui/Brand';

/**
 * Shown instead of the form when it is paused, no longer published or unknown. When the company
 * is known, the visitor can still reach it with the contact data it chose to show.
 */
export function EstimatorUnavailable({
  contact,
  paused = false,
}: {
  contact?: PublicCompanyContact | null;
  paused?: boolean;
}) {
  const phoneHref = contact?.phone ? `tel:${contact.phone.replace(/[^+\d]/g, '')}` : '';
  const emailHref = contact?.email ? `mailto:${contact.email}` : '';
  return (
    <main className="min-h-screen bg-canvas px-4 py-12 sm:py-20">
      <div className="mx-auto max-w-xl">
        <Brand />
        <Card className="mt-12 p-7 text-center sm:p-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <ShieldCheck size={22} />
          </div>
          {contact?.companyName && (
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.15em] text-ink-subtle">
              {contact.companyName}
            </p>
          )}
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
            {paused
              ? 'El formulario está en pausa'
              : contact
                ? 'El formulario no está disponible ahora'
                : 'Este enlace no está disponible'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            {contact
              ? phoneHref || emailHref
                ? 'Puedes contactar directamente con la empresa para pedir tu presupuesto.'
                : 'Vuelve a intentarlo más adelante o contacta con la empresa por otra vía.'
              : 'Puede que haya caducado o que la empresa lo haya retirado. Ponte en contacto con la empresa.'}
          </p>
          {(phoneHref || emailHref) && (
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              {phoneHref && (
                <a href={phoneHref} className={buttonClassName()}>
                  <Phone size={16} /> {contact?.phone}
                </a>
              )}
              {emailHref && (
                <a href={emailHref} className={buttonClassName({ variant: 'outline' })}>
                  <Mail size={16} /> {contact?.email}
                </a>
              )}
            </div>
          )}
        </Card>
        <p className="mt-6 text-center text-xs text-gray-400">Estimador de BudGenerator</p>
      </div>
    </main>
  );
}
