export const es = {
  // Common
  common: {
    loading: 'Cargando...',
    save: 'Guardar',
    saving: 'Guardando...',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    add: 'Añadir',
    back: 'Volver a presupuestos',
    description: 'Descripción',
    unit: 'Ud.',
    cost: 'Coste',
    pvp: 'PVP',
    margin: 'Margen',
  },

  // Login
  login: {
    title: 'Budgenerator',
    subtitle: 'Generador de presupuestos de reformas',
    signIn: 'Iniciar sesión',
    signUp: 'Crear cuenta',
    email: 'Email',
    emailPlaceholder: 'tu@empresa.com',
    password: 'Contraseña',
    passwordPlaceholder: 'Mínimo 6 caracteres',
    enter: 'Entrar',
    register: 'Registrarse',
    hasAccount: '¿Ya tienes cuenta? Inicia sesión',
    noAccount: '¿No tienes cuenta? Regístrate',
    passwordMinLength: 'Mínimo 6 caracteres',
    passwordUppercase: 'Una letra mayúscula',
    passwordLowercase: 'Una letra minúscula',
    passwordNumber: 'Un número',
  },

  // Budget list
  budgetList: {
    title: 'Presupuestos',
    empty: 'No hay presupuestos aún',
    count: (n: number) => `${n} presupuesto${n !== 1 ? 's' : ''}`,
    company: 'Empresa',
    catalog: 'Catálogo',
    newBudget: 'Nuevo presupuesto',
    emptyTitle: 'Sin presupuestos',
    emptySubtitle: 'Crea tu primer presupuesto para empezar',
    createBudget: 'Crear presupuesto',
    noName: 'Sin nombre',
    budgetNumber: (n: string) => `Nº ${n}`,
    sections: (n: number) => `${n} partida${n !== 1 ? 's' : ''}`,
    signOut: 'Cerrar sesión',
    logoutConfirmTitle: '¿Cerrar sesión?',
    logoutConfirmMessage: 'Tendrás que volver a iniciar sesión para acceder a tus presupuestos.',
  },

  // Budget page
  budget: {
    backToBudgets: 'Volver a presupuestos',
    draftBanner: 'Borrador — Este presupuesto no se guardará hasta que pulses',
    draftBannerBold: 'Guardar',
    sections: 'Partidas',
    discard: 'Descartar',
    saveBudget: 'Guardar presupuesto',
    deleteBudget: 'Borrar presupuesto',
    deleteConfirmTitle: '¿Borrar presupuesto?',
    deleteConfirmMessage: 'Se eliminará el presupuesto de forma permanente. Esta acción no se puede deshacer.',
    unsavedChanges: 'Hay cambios sin guardar. ¿Deseas salir sin guardar?',
  },

  // Budget header
  header: {
    title: 'Presupuesto de Reforma',
    clientInfo: 'Información del cliente',
    clientName: 'Nombre del cliente',
    clientNamePlaceholder: 'Nombre completo del cliente',
    address: 'Dirección de la vivienda',
    addressPlaceholder: 'Calle, número, piso...',
    date: 'Fecha',
    budgetNumber: 'Nº Presupuesto',
    budgetNumberPlaceholder: 'Ej. 26038',
  },

  // Budget editor
  editor: {
    emptySections: 'Sin partidas',
    emptySectionsHint: 'Añade una partida para empezar a crear tu presupuesto',
    quantity: 'Cant.',
    price: 'Precio',
    amount: 'Importe',
    addRow: 'Añadir fila',
    deleteSectionTitle: '¿Eliminar partida?',
    deleteSectionMessage: 'Se eliminarán todas las filas de esta partida. Esta acción no se puede deshacer.',
    subtotal: 'Subtotal',
  },

  // Budget summary
  summary: {
    rawSubtotal: 'Subtotal base:',
    surcharge: 'Recargo',
    discount: 'Descuento',
    adjustmentHidden: 'El cliente no verá este ajuste en el PDF',
    subtotal: 'Subtotal:',
    iva: 'IVA (10%):',
    total: 'TOTAL:',
    addDiscount: 'Añadir descuento',
    addSurcharge: 'Añadir recargo',
    removeDiscount: 'Quitar descuento',
    removeSurcharge: 'Quitar recargo',
    newDiscount: 'Nuevo descuento',
    newSurcharge: 'Nuevo recargo',
    percentage: 'Porcentaje',
    reason: 'Motivo (opcional)',
    reasonPlaceholder: 'Ej. distancia, amistad...',
    applyDiscount: 'Aplicar descuento',
    applySurcharge: 'Aplicar recargo',
    profitMargin: 'Margen beneficio:',
  },

  // Add section
  addSection: {
    button: 'Añadir partida',
    fromCatalog: 'Del catálogo',
    custom: 'Personalizada',
    allAdded: 'Todas las categorías ya están añadidas',
    customPlaceholder: 'Nombre de partida personalizada',
  },

  // Tariff selector
  tariffSelector: {
    placeholder: 'Seleccionar tarifa',
  },

  // Export
  export: {
    button: 'Exportar PDF',
    iosAlert: 'Usa el botón de compartir (⎋) de Safari y selecciona "Imprimir" para exportar a PDF.',
  },

  // Catalog
  catalog: {
    title: 'Catálogo de tarifas',
    stats: (concepts: number, categories: number) =>
      `${concepts} conceptos · ${categories} categorías`,
    addConcept: 'Añadir concepto',
    newConcept: 'Nuevo concepto',
    category: 'Categoría',
    categoryPlaceholder: 'Selecciona o escribe',
    costPlaceholder: '0.00',
    pricePlaceholder: '0.00',
    descriptionPlaceholder: 'Ej. Instalación de tarima',
    search: 'Buscar por descripción o categoría...',
    expandAll: 'Expandir todo',
    collapseAll: 'Colapsar todo',
    all: (n: number) => `Todas (${n})`,
    resetDefaults: 'Restaurar catálogo por defecto',
    resetConfirmTitle: '¿Restaurar catálogo?',
    resetConfirmMessage:
      'Se eliminarán todas las tarifas personalizadas y se restaurarán las tarifas por defecto. Esta acción no se puede deshacer.',
    reset: 'Restaurar',
    noResults: (q: string) => `Sin resultados para "${q}"`,
  },

  // Profile
  profile: {
    title: 'Datos de empresa',
    logo: 'Logo',
    removeLogo: 'Eliminar',
    removeLogoTitle: 'Eliminar logo',
    removeLogoMessage: '¿Estás seguro de que quieres eliminar el logo de empresa?',
    uploadLogo: 'Subir logo (max 500KB)',
    uploading: 'Subiendo...',
    logoTooLarge: 'El logo no puede superar 500KB',
    companyName: 'Nombre de la empresa',
    companyNamePlaceholder: 'Mi Empresa S.L.',
    cif: 'CIF / NIF',
    cifPlaceholder: 'B12345678',
    address: 'Dirección',
    addressPlaceholder: 'Calle, número, CP, ciudad',
    phone: 'Teléfono',
    phonePlaceholder: '600 123 456',
    email: 'Email',
    emailPlaceholder: 'info@miempresa.com',
  },
} as const;

export type TranslationKeys = typeof es;
