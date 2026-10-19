export interface HelpQuestion {
  question: string;
  steps: string[];
  link: { to: string; label: string };
}
export interface HelpTopic {
  id: string;
  title: string;
  description: string;
  questions: HelpQuestion[];
}
export const helpTopics: HelpTopic[] = [
  {
    id: 'primeros-pasos',
    title: 'Primeros pasos',
    description: 'Prepara tu espacio y crea el primer documento.',
    questions: [
      {
        question: '¿Cómo preparo mi primer presupuesto?',
        steps: [
          'Completa tus datos en Mi empresa si quieres que aparezcan en el documento.',
          'Revisa el catálogo inicial y ajusta las partidas y precios que utilizas.',
          'En Presupuestos, pulsa Nuevo presupuesto y elige una plantilla o empieza en blanco.',
          'Completa el cliente, añade capítulos y partidas, revisa cantidades e IVA y pulsa Guardar.',
        ],
        link: { to: '/budgets', label: 'Abrir presupuestos' },
      },
      {
        question: '¿Qué diferencia hay entre catálogo, plantilla y presupuesto?',
        steps: [
          'El catálogo contiene tus tarifas: descripción, unidad, coste interno y precio de venta.',
          'La plantilla conserva capítulos y partidas que puedes reutilizar.',
          'El presupuesto es el documento del cliente, con mediciones, precios e importes que puedes editar.',
        ],
        link: { to: '/catalog', label: 'Abrir mi catálogo' },
      },
    ],
  },
  {
    id: 'proyectos',
    title: 'Proyectos y seguimiento',
    description: 'Organiza el trabajo aceptado, registra imprevistos y consulta su evolución.',
    questions: [
      {
        question: '¿Cómo convierto un presupuesto aceptado en proyecto?',
        steps: [
          'Abre el presupuesto guardado, pulsa Marcar como aceptado y confirma la aceptación del cliente.',
          'En ese presupuesto, pulsa Convertir en proyecto. Se crea una copia de trabajo y el presupuesto aceptado queda como referencia.',
          'Abre Proyectos para seguir el avance de los capítulos y sus partidas.',
        ],
        link: { to: '/budgets', label: 'Ver presupuestos para aceptar' },
      },
      {
        question: '¿Cómo registro un imprevisto y actualizo el total del proyecto?',
        steps: [
          'Abre el proyecto y añade el trabajo en Ampliaciones con su cantidad y precio unitario.',
          'La ampliación conserva el IVA del presupuesto aceptado; el total original permanece visible junto al total actualizado.',
          'Si una ampliación no se realiza, anúlala indicando un motivo. El historial se conserva y se resta del trabajo y del importe activos.',
        ],
        link: { to: '/projects', label: 'Abrir proyectos y ampliaciones' },
      },
      {
        question: '¿Puedo corregir la fecha de un trabajo o ver cómo ha avanzado?',
        steps: [
          'Al marcar una partida como terminada se guarda la fecha de hoy.',
          'Pulsa la fecha junto a la partida o al capítulo completado para corregirla; cambiar un capítulo actualiza todas sus partidas.',
          'Abre el icono de evolución del proyecto para consultar el avance acumulado por fecha. Corregir una fecha no cambia el avance actual.',
        ],
        link: { to: '/projects', label: 'Consultar mis proyectos' },
      },
    ],
  },
  {
    id: 'empresa',
    title: 'Empresa y perfil',
    description: 'Los datos que identifican tus presupuestos.',
    questions: [
      {
        question: '¿Cómo añado mi empresa y el logo?',
        steps: [
          'Abre Mi empresa y completa los datos que quieras mostrar en tus documentos.',
          'Sube tu logo y revisa la vista previa.',
          'Guarda los cambios. Los nuevos PDF utilizarán estos datos.',
        ],
        link: { to: '/profile', label: 'Completar mi empresa' },
      },
      {
        question: '¿Por qué aparece una inicial en vez del logo?',
        steps: [
          'La inicial se utiliza si no hay logo o la imagen no se puede cargar.',
          'Revisa la vista previa del logo en Mi empresa y vuelve a subirlo si es necesario.',
        ],
        link: { to: '/profile', label: 'Revisar mi logo' },
      },
    ],
  },
  {
    id: 'catalogos',
    title: 'Catálogo y tarifas',
    description: 'Mantén tus capítulos, partidas y precios en un solo lugar.',
    questions: [
      {
        question: '¿Cómo cambio los precios del catálogo?',
        steps: [
          'Abre Catálogo: tu cuenta ya incluye una base de reformas editable.',
          'Abre el catálogo para añadir o editar capítulos y partidas, con sus unidades, costes y PVP.',
          'Los cambios de tarifas se guardan automáticamente.',
        ],
        link: { to: '/catalog', label: 'Abrir catálogo' },
      },
      {
        question: '¿Cómo utilizo el catálogo en un presupuesto?',
        steps: [
          'Todos los presupuestos utilizan tu único catálogo.',
          'En cada partida, pulsa Aplicar tarifa del catálogo y busca por descripción o capítulo.',
          'Los cambios del catálogo no reescriben partidas ya incorporadas a un presupuesto.',
        ],
        link: { to: '/catalog', label: 'Revisar mi catálogo' },
      },
    ],
  },
  {
    id: 'plantillas',
    title: 'Plantillas',
    description: 'Reutiliza estructuras sin cambiar el original.',
    questions: [
      {
        question: '¿Cómo creo y utilizo una plantilla?',
        steps: [
          'Pulsa Crear plantilla, dale un nombre y define sus capítulos y partidas.',
          'Guarda la plantilla.',
          'En Nuevo presupuesto, elige esa plantilla: trabajarás sobre una copia editable.',
        ],
        link: { to: '/templates', label: 'Abrir plantillas' },
      },
      {
        question: '¿Puedo guardar un presupuesto como plantilla?',
        steps: [
          'Abre un presupuesto guardado.',
          'Pulsa Guardar como plantilla y asigna un nombre.',
          'Revisa la nueva plantilla antes de reutilizarla. Los datos del cliente no forman parte de la plantilla.',
        ],
        link: { to: '/budgets', label: 'Ver mis presupuestos' },
      },
    ],
  },
  {
    id: 'presupuestos',
    title: 'Presupuestos y documentos',
    description: 'Mediciones, importes, PDF y enlaces compartidos.',
    questions: [
      {
        question: '¿Cómo se calculan las partidas, el IVA y los ajustes?',
        steps: [
          'Cada partida multiplica su cantidad por el precio de su unidad.',
          'El descuento reduce el subtotal; el recargo se incorpora a los precios de las partidas.',
          'El IVA se aplica al subtotal ajustado. Revisa el tipo que corresponda al trabajo.',
        ],
        link: { to: '/budgets', label: 'Revisar un presupuesto' },
      },
      {
        question: '¿Cómo exporto o comparto un presupuesto?',
        steps: [
          'Completa el cliente y cada partida: descripción y cantidad mayor que cero. El precio puede ser cero.',
          'Guarda el presupuesto.',
          'Pulsa Exportar PDF para obtener el documento o Crear enlace público para compartirlo.',
          'Puedes revocar el enlace desde el mismo presupuesto. Los costes internos no se incluyen en el documento público.',
        ],
        link: { to: '/budgets', label: 'Exportar desde mis presupuestos' },
      },
    ],
  },
  {
    id: 'cuenta',
    title: 'Cuenta y acceso',
    description: 'Contraseña y condiciones de tu cuenta.',
    questions: [
      {
        question: '¿Dónde cambio mi contraseña o consulto mi plan?',
        steps: [
          'Abre Mi cuenta desde el lateral o el menú superior en móvil.',
          'Consulta el plan y su vigencia, o entra en Cambiar contraseña.',
          'Si tu cuenta admite contraseña, confirma la actual y escribe una nueva.',
        ],
        link: { to: '/account', label: 'Abrir mi cuenta' },
      },
    ],
  },
  {
    id: 'problemas',
    title: 'Problemas frecuentes',
    description: 'Guardado, red y recuperación del trabajo.',
    questions: [
      {
        question: '¿Qué hago si falla el guardado o no tengo conexión?',
        steps: [
          'Mantén la aplicación abierta y recupera la conexión.',
          'Si aparece un error de guardado, usa Reintentar guardado.',
          'Comprueba los cambios antes de cerrar sesión o actualizar la aplicación. La PWA guarda recursos de la app, pero necesita red para cargar y guardar documentos nuevos.',
        ],
        link: { to: '/budgets', label: 'Comprobar mis presupuestos' },
      },
      {
        question: '¿Cómo elimino un documento sin hacerlo por error?',
        steps: [
          'Abre las acciones del elemento en el listado. En móvil también puedes deslizar a la izquierda.',
          'Pulsa Eliminar y revisa la confirmación.',
          'Cancela para conservarlo o confirma el borrado. Deslizar por sí solo nunca elimina datos.',
        ],
        link: { to: '/budgets', label: 'Volver al listado de presupuestos' },
      },
    ],
  },
];
