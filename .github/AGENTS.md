# budgenerator — Project instructions

SPA de presupuestos para profesionales: React 19, TypeScript 6, Vite 8, Tailwind 4, Zustand 5, Firebase Auth/Firestore/Hosting y jsPDF. Identidad visible budgenerator; proyecto Firebase budgenerator.

- Usar pnpm. Leer README y docs/stability-and-release.md para el estado actual y las transiciones de seguridad.
- Capas: app → pages → features → entities → shared. El editor compartido está en features/budget-editor. Shared no importa entidades.
- CRUD de Firebase en entities/<entity>/api. Mantener la revisión de sesión y las colas por documento; no volver a cargar listas desde cada guard.
- Cálculos monetarios en shared/lib/budgetMath.ts. Reutilizar en editor, visor y PDF. No publicar objetos privados completos: usar el DTO público.
- Probar con pnpm lint, pnpm test, pnpm test:integration y pnpm build según el cambio. Los emuladores requieren un projectId demo-.
- Mantener el contrato de PWA: recursos de una versión coherente, ningún dato Firebase en Cache Storage, updates explícitos y sin recarga sobre cambios sin guardar.
- Estilos: tokens, fuentes locales y componentes compartidos. Mantener responsive, nombres accesibles y manejo visible de errores.
- Las contraseñas de producción están exclusivamente en documentación local ignorada. Nunca hardcodear credenciales reales ni versionarlas.
- No hacer commit ni push automáticamente sin petición explícita del usuario.
- No desplegar sin autorización del usuario. El deploy solo Hosting y el de reglas/Hosting tienen scripts separados.
