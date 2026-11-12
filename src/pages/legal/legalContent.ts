/**
 * Legal texts (templates). Every `[COMPLETAR: …]` must be filled in by the owner,
 * ideally reviewed by a legal adviser, before opening registration to the public.
 * Bump `LEGAL_TERMS_VERSION` (shared/lib/legal.ts) whenever these texts change.
 */

export type LegalDocumentId = 'privacidad' | 'condiciones' | 'aviso-legal' | 'cookies';

export interface LegalDocument {
  title: string;
  sections: { heading: string; paragraphs: string[] }[];
}

const owner = '[COMPLETAR: nombre o razón social del titular]';
const contact = '[COMPLETAR: email de contacto para privacidad]';

export const LEGAL_DOCUMENTS: Record<LegalDocumentId, LegalDocument> = {
  'aviso-legal': {
    title: 'Aviso legal',
    sections: [
      {
        heading: 'Titular del sitio',
        paragraphs: [
          `En cumplimiento del artículo 10 de la Ley 34/2002 (LSSI-CE), el titular de BudGenerator es ${owner}, con NIF [COMPLETAR: NIF/CIF] y domicilio en [COMPLETAR: dirección postal].`,
          `Contacto: ${contact}. [COMPLETAR: datos registrales si se trata de una sociedad: Registro Mercantil, tomo, folio y hoja].`,
        ],
      },
      {
        heading: 'Objeto',
        paragraphs: [
          'BudGenerator es una herramienta web para preparar presupuestos de reformas, seguir proyectos y recibir solicitudes de presupuesto. El uso de la aplicación se rige por las condiciones de uso.',
        ],
      },
      {
        heading: 'Propiedad intelectual',
        paragraphs: [
          'El software, el diseño y los textos de la aplicación pertenecen al titular o a sus licenciantes. Los datos que introduce cada usuario le pertenecen a él.',
        ],
      },
      {
        heading: 'Responsabilidad',
        paragraphs: [
          'El titular no responde de los contenidos que los usuarios publiquen mediante enlaces públicos ni de las decisiones tomadas a partir de importes orientativos. Se retirarán los contenidos ilícitos en cuanto se tenga conocimiento efectivo de ellos.',
        ],
      },
      {
        heading: 'Legislación aplicable',
        paragraphs: [
          'Se aplica la legislación española. [COMPLETAR: juzgados competentes, respetando el fuero del consumidor cuando corresponda].',
        ],
      },
    ],
  },
  privacidad: {
    title: 'Política de privacidad',
    sections: [
      {
        heading: 'Responsable del tratamiento',
        paragraphs: [
          `${owner}, NIF [COMPLETAR: NIF/CIF], domicilio en [COMPLETAR: dirección]. Contacto: ${contact}.`,
        ],
      },
      {
        heading: 'Datos que tratamos y para qué',
        paragraphs: [
          'Cuenta: email, contraseña (cifrada por Firebase Authentication), plan y fecha de aceptación de estas condiciones. Base jurídica: ejecución del contrato.',
          'Datos de tu empresa y de tu trabajo: perfil, logo, catálogo, plantillas, presupuestos, proyectos y equipo. Base jurídica: ejecución del contrato.',
          'Dispositivos para avisos push: un identificador técnico del navegador o del móvil, solo si activas los avisos. Base jurídica: consentimiento, que puedes retirar en Mi cuenta.',
          'Registros técnicos y de seguridad sin datos personales en claro (los identificadores se seudonimizan) y verificación anti-abuso de App Check con reCAPTCHA. Base jurídica: interés legítimo en proteger el servicio.',
        ],
      },
      {
        heading: 'Datos de tus clientes y solicitudes recibidas',
        paragraphs: [
          'Los datos de tus clientes que incluyes en presupuestos y los que envían los visitantes de tu estimador público son responsabilidad tuya. BudGenerator los trata como encargado del tratamiento, solo para prestarte el servicio. [COMPLETAR: contrato de encargo del artículo 28 RGPD o cláusula equivalente en las condiciones].',
        ],
      },
      {
        heading: 'Plazos de conservación',
        paragraphs: [
          'Cuenta y contenido: mientras la cuenta exista. Al borrarla se eliminan todos los datos de forma inmediata e irreversible.',
          'Solicitudes de presupuesto (leads): 12 meses desde su recepción; después se borran automáticamente.',
          'Enlaces públicos de presupuestos: hasta su caducidad (máximo 31 días); después se borran automáticamente.',
          'Dispositivos push: se eliminan tras 270 días sin actividad o al cerrar sesión.',
          'Copias de seguridad: [COMPLETAR: plazo de retención de backups, por ejemplo 30 días].',
        ],
      },
      {
        heading: 'Destinatarios y ubicación',
        paragraphs: [
          'Los datos se alojan en Google Cloud / Firebase (Google Ireland Ltd.), en la región europe-southwest1 (Madrid). Google actúa como encargado del tratamiento. [COMPLETAR: revisar transferencias internacionales y cláusulas contractuales tipo de Google].',
          'No vendemos ni cedemos datos a terceros con fines comerciales.',
        ],
      },
      {
        heading: 'Tus derechos',
        paragraphs: [
          'Puedes descargar todos tus datos (acceso y portabilidad) y borrar tu cuenta (supresión) desde Mi cuenta. Para rectificación, oposición o limitación, escribe a ' +
            `${contact}.`,
          'Si no estás conforme, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).',
        ],
      },
    ],
  },
  condiciones: {
    title: 'Condiciones de uso',
    sections: [
      {
        heading: 'Objeto y aceptación',
        paragraphs: [
          `Estas condiciones regulan el uso de BudGenerator, prestado por ${owner}. Al crear una cuenta declaras haberlas leído y aceptado, junto con la política de privacidad.`,
        ],
      },
      {
        heading: 'Cuenta',
        paragraphs: [
          'Debes usar un email propio y verificarlo. La contraseña debe tener al menos 8 caracteres y es personal. Eres responsable de la actividad de tu cuenta.',
          'Publicar el estimador o compartir presupuestos requiere un email verificado.',
        ],
      },
      {
        heading: 'Planes',
        paragraphs: [
          'El plan gratuito permite crear un número limitado de presupuestos. [COMPLETAR: precio, duración y forma de pago del plan Pro cuando exista].',
        ],
      },
      {
        heading: 'Uso aceptable',
        paragraphs: [
          'No está permitido usar la aplicación para publicar contenido ilícito o engañoso, suplantar a terceros, enviar solicitudes automatizadas o intentar acceder a datos de otras cuentas. Podemos suspender cuentas que incumplan estas normas.',
          'Debes contar con legitimación para tratar los datos de tus clientes que introduces.',
        ],
      },
      {
        heading: 'Importes y responsabilidad',
        paragraphs: [
          'Los importes y horquillas que calcula la aplicación son orientativos y se basan en los datos que introduces. Revisa cada presupuesto antes de enviarlo. [COMPLETAR: limitación de responsabilidad conforme a la normativa de consumidores si aplica].',
        ],
      },
      {
        heading: 'Baja',
        paragraphs: [
          'Puedes borrar tu cuenta en cualquier momento desde Mi cuenta. El borrado elimina todos tus datos y no se puede deshacer.',
        ],
      },
      {
        heading: 'Cambios y ley aplicable',
        paragraphs: [
          'Avisaremos de los cambios relevantes con antelación razonable. Se aplica la legislación española. [COMPLETAR: jurisdicción].',
        ],
      },
    ],
  },
  cookies: {
    title: 'Política de cookies',
    sections: [
      {
        heading: 'Qué usamos',
        paragraphs: [
          'BudGenerator no usa cookies de analítica ni de publicidad.',
          'Usamos almacenamiento técnico del navegador (IndexedDB, localStorage y la caché del service worker) para mantener la sesión, guardar una copia local de tus datos y funcionar sin conexión. Es imprescindible para prestar el servicio y no requiere consentimiento.',
          'Cuando la protección App Check está activa, Google reCAPTCHA puede usar cookies propias para distinguir personas de bots. [COMPLETAR: confirmar con asesor si se consideran estrictamente necesarias o requieren consentimiento].',
        ],
      },
      {
        heading: 'Cómo eliminarlas',
        paragraphs: [
          'Al cerrar sesión se borran los datos locales de tu cuenta. También puedes borrar los datos del sitio desde la configuración de tu navegador.',
        ],
      },
    ],
  },
};

export function isLegalDocumentId(value: string | undefined): value is LegalDocumentId {
  return value !== undefined && value in LEGAL_DOCUMENTS;
}
