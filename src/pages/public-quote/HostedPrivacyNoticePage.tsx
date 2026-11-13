import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchHostedPrivacyNotice, type HostedPrivacyNotice } from '@/entities/quote-estimator';
import { formatDate } from '@/shared/lib';
import { Card } from '@/shared/ui';
import { Brand } from '@/shared/ui/Brand';
import { LoadingScreen } from '@/shared/ui/LoadingScreen';

const ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

/** Ends a sentence without doubling the stop of names such as «Reformas García, S.L.». */
function sentence(text: string) {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/**
 * Privacy notice that BudGenerator hosts for companies without a website. It only covers the
 * requests sent through the public form. Template text: review it with a legal advisor before
 * opening sign-up to the public (docs/specs BG-013).
 */
export function HostedPrivacyNoticePage() {
  const { noticeId = '' } = useParams();
  const valid = ID_PATTERN.test(noticeId);
  const [notice, setNotice] = useState<HostedPrivacyNotice | null | undefined>(undefined);

  useEffect(() => {
    if (!valid) return;
    let active = true;
    fetchHostedPrivacyNotice(noticeId)
      .then((value) => {
        if (active) setNotice(value);
      })
      .catch(() => {
        if (active) setNotice(null);
      });
    return () => {
      active = false;
    };
  }, [noticeId, valid]);

  if (valid && notice === undefined) return <LoadingScreen />;
  if (!valid || !notice)
    return (
      <main className="min-h-screen bg-canvas px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Brand />
          <Card className="mt-10 p-7">
            <h1 className="text-2xl font-semibold text-gray-900">Aviso no disponible</h1>
            <p className="mt-2 text-sm text-gray-600">
              Este aviso de privacidad ya no existe. Contacta con la empresa que te envió el enlace.
            </p>
          </Card>
        </div>
      </main>
    );

  const holder = [notice.companyName, notice.cif && `NIF ${notice.cif}`, notice.address].filter(
    Boolean,
  );
  const contact = notice.email || notice.address;
  return (
    <main className="min-h-screen bg-canvas px-4 py-10">
      <article className="mx-auto max-w-2xl space-y-6 text-sm leading-6 text-gray-700">
        <Brand />
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-subtle">
            {notice.companyName}
          </p>
          <h1 className="mt-2 font-serif text-3xl text-gray-900">Aviso de privacidad</h1>
          <p className="mt-1 text-xs text-gray-500">
            {sentence(
              `Solicitudes de presupuesto enviadas desde el formulario de ${notice.companyName}`,
            )}
            {notice.updatedAt && ` Actualizado el ${formatDate(notice.updatedAt)}.`}
          </p>
        </header>
        <section>
          <h2 className="text-base font-semibold text-gray-900">Responsable del tratamiento</h2>
          <p>{sentence(holder.join(' · '))}</p>
          {(notice.email || notice.phone) && (
            <p>Contacto: {[notice.email, notice.phone].filter(Boolean).join(' · ')}.</p>
          )}
        </section>
        <section>
          <h2 className="text-base font-semibold text-gray-900">Qué datos tratamos y para qué</h2>
          <p>
            Tu nombre, email y teléfono, las estancias y superficies que indicas, el plazo de inicio
            y la estimación calculada. Los usamos solo para responder a tu solicitud y, si quieres,
            prepararte un presupuesto. No enviamos comunicaciones comerciales.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-gray-900">Base legal</h2>
          <p>
            Tu consentimiento al enviar el formulario y la aplicación de medidas precontractuales a
            petición tuya (artículo 6.1.a y 6.1.b del RGPD).
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-gray-900">Cuánto tiempo los conservamos</h2>
          <p>
            Tus datos de contacto se conservan 12 meses desde que recibimos la solicitud. Después se
            anonimizan y solo queda la reforma solicitada, sin datos que te identifiquen. Si
            llegamos a firmar un presupuesto, se conservará el tiempo que exija la ley.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-gray-900">Quién más accede</h2>
          <p>
            BudGenerator, que presta el servicio del formulario como encargado del tratamiento, y su
            proveedor de infraestructura (Google Cloud, con servidores en la Unión Europea). No
            cedemos tus datos a terceros salvo obligación legal.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-gray-900">Tus derechos</h2>
          <p>
            Puedes pedir el acceso, la rectificación o la supresión de tus datos, oponerte o limitar
            su tratamiento y retirar tu consentimiento
            {contact ? ` escribiendo a ${contact}` : ''}. Si no quedas conforme, puedes reclamar
            ante la Agencia Española de Protección de Datos (aepd.es).
          </p>
        </section>
      </article>
    </main>
  );
}
