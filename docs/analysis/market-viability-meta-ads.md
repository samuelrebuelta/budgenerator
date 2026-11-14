# Viabilidad de mercado y captación con Meta Ads — BudGenerator

Fecha del análisis: 11-11-2026. Autoría: análisis de producto y growth asistido por IA a partir de la documentación del repositorio (`docs/product.md`, `docs/plan.md`, `README.md`, specs BG-004 y BG-005) y búsqueda web.

**Cómo leer este documento**

- Cada cifra externa lleva su fuente. Las cifras marcadas como **[Estimación]** son cálculos propios: el supuesto se explica al lado.
- Muchos benchmarks de anuncios proceden de agregadores o blogs de proveedores con metodologías distintas. Sirven para dimensionar el test, no para prometer resultados. El test real sustituye a cualquier benchmark a partir de la semana 2.
- No hay métricas de clientes, testimonios ni investigación de usuarios documentados (`docs/product.md`, "Evidence on Hand"). Todo lo relativo al dolor del cliente es hipótesis que hay que validar con entrevistas.

---

## Resumen ejecutivo

- **Veredicto:** viable como negocio pequeño y rentable si se valida antes de escalar. **No es viable lanzar Meta Ads ya**: faltan cobro (Stripe aplazado en BG-004), landing comercial, analítica de conversión y textos legales. Lanzar el test de pago es razonable tras 6 a 8 semanas de preparación.
- **Mercado:** unos 389.000 empresas activas de construcción en España ([INE, DIRCE 2025](https://www.ine.es/dyngs/Prensa/es/DIRCE2025.htm)) y unos 410.000 autónomos de construcción **[Estimación]: 12 % de 3,41 M de afiliados al RETA** ([UPTA, 1.er semestre 2025](https://upta.es/wp-content/uploads/2025/07/UPTA_Informe-afiliacion-autonomos-primer-semestre-2025.pdf)). Ambas cifras se solapan y no deben sumarse.
- **Hueco:** las herramientas de facturación (Holded, Billin, Quipu, STEL Order) hacen presupuestos genéricos y las de mediciones (Presto, Arquímedes) son caras y de oficina técnica. Hay espacio para algo **móvil, rápido, con precios por partida y un estimador que capta clientes**.
- **Economía unitaria:** a 19,99 €/mes + IVA, con churn mensual del 4-6 % ([rangos SMB](https://userjot.com/blog/saas-churn-rate-benchmarks)), el LTV bruto ronda 300-450 € **[Estimación]**. El CAC pagado debe quedar por debajo de **~120-150 €** para un LTV:CAC ≥ 3 y una recuperación en menos de 8 meses.
- **Embudo de Meta [Estimación]:** con CPM de 6-10 € ([Adligator, CPM por país 2026](https://adligator.com/es/blog/cpm-facebook-por-pais-2026)), el escenario base da un coste por registro de ~10 € y un CAC de ~170-330 € con freemium. Solo es rentable si la conversión a pago supera el 6-8 % o se añade una prueba Pro inversa que la suba.
- **Recomendación:** test de **1.000 € en 4-6 semanas** tras la preparación. El escenario de 300 € solo vale para validar mensajes y creatividades. El de 3.000 € solo si el de 1.000 € cumple los criterios de éxito.

---

## 1. Mercado

### 1.1 Tamaño

| Indicador                                            | Valor                                         | Fuente                                                                                                                                                                                            |
| ---------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empresas activas en construcción (01-01-2025)        | 389.146 (11,8 % del total)                    | [INE, DIRCE 2025](https://www.ine.es/dyngs/Prensa/es/DIRCE2025.htm)                                                                                                                               |
| Empresas sin asalariados (todas las actividades)     | 1,80 M (54,4 %)                               | [INE, DIRCE 2025](https://www.ine.es/dyngs/Prensa/es/DIRCE2025.htm)                                                                                                                               |
| Peso de pymes sin asalariados en construcción (2024) | 51,8 %                                        | [IPYME, Retrato PYME DIRCE 2024](https://ipyme.org/Publicaciones/Retrato%20de%20la%20PYME/Retrato_Pyme_DIRCE_2024.pdf)                                                                            |
| Afiliados al RETA (junio 2025)                       | 3.409.563, de los que el 12 % es construcción | [UPTA](https://upta.es/wp-content/uploads/2025/07/UPTA_Informe-afiliacion-autonomos-primer-semestre-2025.pdf)                                                                                     |
| Autónomos de construcción                            | ~410.000 **[Estimación]**                     | 12 % × 3,41 M. No es una cifra publicada.                                                                                                                                                         |
| Crecimiento de autónomos de construcción en 2025     | +2,8 % (+11.709)                              | Cita recogida en el [observatorio de autónomos de la CARM, enero 2026](https://autonomos.carm.es/documents/d/guest/2026-1-observatrio-enero). Conviene contrastarla con el Ministerio de Trabajo. |
| Digitalización: pymes con intensidad digital básica  | 74,2 % (todas las actividades)                | ONTSI 2025, recogido por [CIO España](https://www.cio.com/article/4039919/decada-digital-2025-en-espana-aprobado-en-infraestructura-digital-necesita-mejorar-en-pymes.html)                       |
| Autónomos con al menos una herramienta digital       | 96 %                                          | [Holded, Informe Emprende](https://www.holded.com/es/blog/ia-autonomos). Fuente de un proveedor y sin desglose por sector.                                                                        |

No he encontrado un dato público fiable del porcentaje de pymes de construcción que usa software de presupuestos. Las fuentes del sector repiten que es una de las actividades menos digitalizadas, pero sin cifra verificable. **Supuesto de trabajo:** una parte grande del segmento objetivo presupuesta con Word, Excel, plantillas en PDF o apps de facturación genéricas. Hay que validarlo con entrevistas (sección 9).

**Mercado direccionable [Estimación]:**

- **TAM:** ~400.000 unidades económicas de construcción. Es el orden de magnitud de cualquiera de las dos cifras, no su suma.
- **SAM:** reformas, acabados e instalaciones (sobre todo CNAE 43, construcción especializada), con uso de móvil y disposición a pagar software. Supongo entre el 30 y el 40 % del TAM: **120.000-160.000**. El supuesto es que el CNAE 43 es la mayoría del sector y que no todos presupuestan obra a cliente final.
- **SOM a 12-24 meses:** entre 0,1 y 0,3 % del SAM: **120-480 cuentas de pago**. A 19,99 €/mes eso son **~2.400-9.600 € de MRR**. Es un negocio _bootstrapped_ viable, no un caso de capital riesgo.

### 1.2 Segmentos objetivo

| Segmento                                                      | Perfil                                                                              | Dolor probable (hipótesis)                                                                                         | Encaje con BudGenerator                                                                                             |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **A. Autónomo multioficio o reformista**                      | 1-2 personas. Presupuesta en el móvil o por la noche y compite en precio y rapidez. | Presupuestar lleva horas, el aspecto es poco profesional, se olvidan partidas y se cobra de menos por imprevistos. | **Alto:** catálogo y plantillas, PDF profesional, suplementos en Proyectos. Es el público natural de Meta.          |
| **B. Pequeña empresa de reformas (3-15 personas)**            | Encargado o gerente con varias cuadrillas y obras simultáneas.                      | Coordinar quién va a qué obra, controlar desviaciones y captar clientes sin depender de portales.                  | **Alto:** Proyectos, Equipo y planificación semanal, estimador público y avisos push. Mayor disposición a pagar.    |
| **C. Instaladores (fontanería, electricidad, climatización)** | Mucho trabajo pequeño y recurrente, avisos y SAT.                                   | Partes de trabajo, material, facturación rápida y certificados.                                                    | **Medio:** necesitan SAT y facturación (STEL Order cubre esto). BudGenerator no factura. Mejor segmento secundario. |

**Recomendación:** lanzar con **A + B (reformas)** y un mensaje único. Los instaladores entran de forma orgánica, sin mensaje específico, hasta que exista un puente a facturación.

---

## 2. Competencia en España

### 2.1 Tabla comparativa

Precios sin IVA salvo que se indique. Hay que confirmarlos en la web de cada proveedor antes de usarlos en material comercial.

| Herramienta                                                     | Categoría                                                                                     | Precio orientativo                                                                                                                   | Propuesta                                                                                        | Huecos frente a BudGenerator                                                        | Fuente                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Presto (RIB)**                                                | Mediciones y presupuestos profesionales, escritorio                                           | Desde ~100 €/mes (dato de un competidor, no oficial); sin plan gratis                                                                | Estándar de oficina técnica, BC3, control de costes                                              | Curva de aprendizaje alta, orientado a técnico y no al móvil, caro para un autónomo | [OneEstimate vs Presto](https://oneestimate.ai/es/comparar/oneestimate-vs-presto), [Capterra](https://www.capterra.es/software/193000/presto)                                                                                                                                      |
| **Arquímedes (CYPE)**                                           | Mediciones, presupuestos y pliegos, escritorio                                                | Sin precio público. Renovaciones de licencias CYPE de varios miles de euros en compras públicas                                      | Generador de precios y bases de datos de partidas                                                | Igual que Presto: técnico y de escritorio                                           | [Hackceleration](https://hackceleration.com/es/labs/mejor/programa-presupuestos-obra), [Ayto. Zaragoza](https://www.zaragoza.es/web/hacienda-economia/servicio/factura/proveedor/11662)                                                                                            |
| **Gest-Obra**                                                   | Gestión de obra                                                                               | No he encontrado información pública verificable                                                                                     | —                                                                                                | —                                                                                   | Sin fuente                                                                                                                                                                                                                                                                         |
| **Obralia**                                                     | Plataforma de CAE (coordinación de actividades empresariales y documentación de subcontratas) | —                                                                                                                                    | No es competidor directo: cubre la documentación para grandes constructoras                      | No presupuesta                                                                      | Conocimiento general del sector. Pendiente de verificar si se incluye.                                                                                                                                                                                                             |
| **STEL Order**                                                  | ERP y SAT para instaladores y servicios                                                       | Lite desde ~18 €/mes (pago bienal). Business ~36 €/mes en mensual, más 18 € por usuario extra. Incluye VeriFactu                     | Presupuestos, albaranes, facturas, SAT y app móvil                                               | Genérico; sin estimador público ni captación de leads; caro por usuario             | [Hackceleration, alternativas a STEL Order](https://hackceleration.com/es/labs/cambiar/stel-order)                                                                                                                                                                                 |
| **Holded**                                                      | Facturación, contabilidad y ERP                                                               | Plan para autónomos de ~15 €/mes (7,50 € con promoción anual), según terceros                                                        | Facturación, contabilidad, proyectos y CRM                                                       | Sin bases de precios de construcción ni partidas                                    | [Guía deSoftware](https://www.guiadesoftware.com/software/holded), [Finom](https://finom.co/es-es/blog/holded-precios/), [STEL Order blog](https://www.stelorder.com/blog/mejores-programas-presupuestos-de-obra/)                                                                 |
| **Quipu**                                                       | Facturación y contabilidad para autónomos                                                     | 17 / 30 / 59 €/mes                                                                                                                   | Facturas, gastos, impuestos y conexión con la gestoría                                           | No resuelve el presupuesto técnico                                                  | [Guiafiscal](https://guiafiscal.es/comparativas/quipu-opiniones/)                                                                                                                                                                                                                  |
| **Billin (TeamSystem)**                                         | Facturación                                                                                   | 8 / 17 / 28 €/mes en mensual (6,6 / 14 / 23 € en anual). Prueba de 30 días. VeriFactu y TicketBAI incluidos                          | Facturas y presupuestos ilimitados; generador gratuito de presupuestos de reformas como imán SEO | Presupuesto sin catálogo de partidas ni seguimiento de obra                         | [Billin, precios](https://www.billin.net/precios/), [generador de reformas](https://www.billin.net/generadores/generador-presupuestos-reformas-instalaciones-hogar/)                                                                                                               |
| **Contasimple**                                                 | Facturación y contabilidad                                                                    | Gratis (limitado) / 12,95 €/mes                                                                                                      | Barato y sencillo                                                                                | Genérico                                                                            | [Guiafiscal](https://guiafiscal.es/comparativas/mejor-programa-facturacion-autonomos/)                                                                                                                                                                                             |
| **Motor de Presupuestos, ConstruCloud, Kubysoft y otros nicho** | Presupuestos y gestión de reformas                                                            | Desde 39 € (Motor de Presupuestos); ConstruCloud gratis hasta 3 obras; Kubysoft desde 49 €/mes                                       | Partidas de reforma y gestión de obra                                                            | Distintos grados de madurez móvil; poca captación de leads                          | [Hackceleration](https://hackceleration.com/es/labs/mejor/programa-presupuestos-autonomos), [Capterra](https://www.capterra.es/software/1098825/Motor-de-Presupuestos), [Softwaredoit](https://www.softwaredoit.es/software-construccion/presupuestos-gestion-obras-reformas.html) |
| **Habitissimo**                                                 | Marketplace de leads                                                                          | Modelo de cuota. No he encontrado tarifa pública en España; su web dice "sin planes, sin comisiones, sin permanencia"                | Canal de captación de clientes finales                                                           | Es un canal, no una herramienta; el lead es compartido entre varios profesionales   | [habitissimo.es](https://www.habitissimo.es/), [comparativa de Cronoshare](https://www.cronoshare.com/comunidad/comparativas/cronoshare-vs-habitissimo-espana)                                                                                                                     |
| **Cronoshare**                                                  | Marketplace de leads                                                                          | Pago por contacto en créditos ("cronos"); una reforma integral publicada en Lleida costaba 344 cronos; sin tarifa en euros publicada | Lead bajo demanda                                                                                | Lead compartido y quejas por calidad del lead                                       | [Cronoshare](https://www.cronoshare.com/comunidad/comparativas/cronoshare-vs-habitissimo-espana), [ejemplo de anuncio](https://www.cronoshare.com/presupuesto-reforma-integral-vivienda-lleida-lleida-tarea-4465748-web)                                                           |

### 2.2 Lectura competitiva

- El mercado se parte en tres: **facturación genérica** barata (8-30 €/mes, VeriFactu incluido), **mediciones técnicas** caras y de escritorio, y **marketplaces de leads** que cobran por contacto. Nadie que haya encontrado combina, para el autónomo de reformas, _presupuesto por partidas en el móvil + seguimiento de obra + estimador propio que capta clientes_.
- **Habitissimo y Cronoshare son a la vez canal y argumento:** el reformista paga por leads compartidos. El estimador de BudGenerator ofrece _leads propios, desde tu web, Google Business o redes, sin pagar por contacto_. Es el gancho comercial más fuerte del producto. Es una hipótesis que conviene validar.
- Billin ya usa un generador gratuito de presupuestos de reformas como imán SEO. La palabra clave "plantilla/generador de presupuesto de reforma" está disputada, pero confirma que hay demanda.

### 2.3 Diferenciales reales de BudGenerator

Basado en las capacidades documentadas en `docs/product.md` y el `README.md`:

1. **Catálogo de partidas con 21 bases y 211 tarifas**, plantillas y cálculos con IVA y descuentos/recargos. Permite presupuestar en minutos con precios propios.
2. **Estimador público embebible** con horquilla por estancia y m², captura de lead con aviso push y conversión de la solicitud en presupuesto. No he encontrado este flujo en los competidores de facturación.
3. **Proyectos con presupuesto original inmutable y suplementos.** Resuelve el "me comí los imprevistos".
4. **Equipo y planificación semanal** de personas y cuadrillas, con avisos de doble asignación.
5. **PWA con modo offline**, útil en obra sin cobertura.
6. Enlaces públicos sin costes internos y con revocación, y PDF A4 cuidado.

### 2.4 Debilidades

| Debilidad                                             | Impacto comercial                                                                                                                                                                | Recomendación                                                                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sin facturación**                                   | Alto. El autónomo quiere _un_ sitio; si ya paga Holded o Billin, BudGenerator es una herramienta más.                                                                            | No construir facturación ahora. Posicionarse como "el paso previo a la factura" y añadir **exportación limpia** (CSV, PDF, BC3) o integración con 1-2 herramientas de facturación más adelante. |
| **Sin VeriFactu/TicketBAI**                           | Bajo hoy (ver 2.5). Sería alto si se añadiera facturación.                                                                                                                       | No es requisito mientras no se emitan facturas.                                                                                                                                                 |
| **Sin cobro (Stripe aplazado)**                       | Bloqueante para anuncios: no se puede medir CAC ni LTV.                                                                                                                          | Implementar BG-004 antes del test de pago.                                                                                                                                                      |
| **Sin app nativa**                                    | Medio. La PWA instalable funciona, pero el usuario de Meta busca "la app" en las tiendas y en iOS las notificaciones push de una PWA exigen instalarla en la pantalla de inicio. | No es prioritario. Crear un onboarding de instalación claro. Valorar un _wrapper_ (TWA en Android) solo si los datos de activación lo piden.                                                    |
| **Sin landing comercial, testimonios ni casos**       | Alto para la conversión de anuncios.                                                                                                                                             | Landing antes del test y 3-5 usuarios piloto con testimonios reales.                                                                                                                            |
| **Pagos de clientes finales y firma del presupuesto** | Medio. La aceptación online del presupuesto ayuda a cerrar ventas.                                                                                                               | Valorar la "aceptación con un clic" en el enlace público como mejora de alto valor y bajo coste.                                                                                                |

### 2.5 VeriFactu y la ley antifraude: ¿requisito u oportunidad?

- **Marco:** la Ley 11/2021 antifraude está en vigor. El Reglamento de sistemas informáticos de facturación (RD 1007/2023), conocido como VeriFactu, se aplica a los **programas que emiten o registran facturas**.
- **Calendario legal vigente:** el RDL 15/2025 lo aplazó al **1 de enero de 2027 para sociedades** y al **1 de julio de 2027 para autónomos** ([Quipu](https://getquipu.com/blog/verifactu-se-retrasa/), [Billin](https://www.billin.net/blog/hacienda-retrasa-verifactu-a-2027/)).
- **Anuncio de octubre de 2026:** Hacienda anunció un nuevo aplazamiento a **octubre de 2028**, alineado con la factura electrónica B2B. Según varias fuentes, **todavía no se ha publicado en el BOE**, así que las fechas de 2027 siguen siendo las legales hasta que se modifique la norma ([Fieldfisher](https://www.fieldfisher.com/es-es/locations/espana/actualidad/verifactu-aplazamiento-octubre-2028), [Renn](https://getrenn.com/es/blog/verifactu-aplazado), [Emprendedores](https://emprendedores.es/gestion/aplazamiento-verifactu-2028/)). **PENDIENTE:** verificar en el BOE antes de cualquier comunicación comercial.
- **Para BudGenerator:** un presupuesto no es una factura. Mientras BudGenerator no emita facturas, **VeriFactu no es requisito** **[Interpretación propia, no es asesoramiento jurídico: conviene confirmarlo con un asesor fiscal]**.
- **Riesgo:** si se añade facturación, BudGenerator pasa a ser un sistema informático de facturación. Eso exige cumplir el reglamento (registros encadenados, QR, declaración responsable del fabricante) y, en el País Vasco, TicketBAI. Es mucho alcance para un equipo pequeño.
- **Oportunidad:** VeriFactu obligará a muchos autónomos a cambiar o estrenar software de facturación entre 2027 y 2028. Ese momento de decisión es una ventana para captar su atención con "presupuesta en BudGenerator y factura en tu programa VeriFactu". La vía es una integración o exportación, no construir facturación. El contenido SEO sobre "VeriFactu para reformistas" también puede atraer tráfico cualificado.

---

## 3. Posicionamiento, pricing y requisitos previos al pago de anuncios

### 3.1 Posicionamiento propuesto

> **"Presupuestos de reforma en 5 minutos desde el móvil, y clientes que te llegan solos desde tu web."**

- Público: reformistas y pequeñas empresas de reformas que hoy presupuestan con Excel, Word o WhatsApp.
- Prueba de valor (hay que verificarla antes de anunciarla): tiempo para crear el primer presupuesto con PDF, por debajo de 10 minutos.
- Enemigo narrativo: "pagar por leads compartidos" y "pasar las noches con el Excel".
- No prometer facturación, contabilidad ni ahorro de horas no medido. `docs/product.md` prohíbe inventar métricas.

### 3.2 Pricing recomendado

| Elemento              | Recomendación                                                                                                                                                           | Motivo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modelo                | **Freemium con "prueba inversa":** 14 días de Pro al registrarse y después Free limitado                                                                                | Con freemium puro, la conversión típica en SMB es del 2-5 % ([Userpilot](https://userpilot.com/blog/freemium-saas/), [First Page Sage vía Crazy Egg](https://www.crazyegg.com/blog/free-to-paid-conversion-rate/?pp=iaqb)). Las pruebas _opt-in_ rondan el 17-18 % de prueba a pago ([mismas fuentes](https://www.crazyegg.com/blog/free-to-paid-conversion-rate/?pp=iaqb)). La prueba inversa enseña el valor de Pro (estimador y equipo) sin perder el gancho de "gratis". Exige cambiar BG-004, que hoy excluye periodos de prueba: **es una decisión de producto que hay que proponer, no imponer**. |
| Free                  | 3 presupuestos o proyectos **activos** (propuesta de BG-004); catálogo y plantillas ilimitados; PDF con una marca discreta de "Hecho con BudGenerator" **[propuesta]**  | La marca en el PDF es un canal viral entre clientes finales y otros gremios                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Pro                   | **19,99 €/mes + IVA** (BG-004); **plan anual de 199 € + IVA** (2 meses gratis) **[propuesta]**                                                                          | Es coherente con Billin Pro (17 €), Quipu Starter (17 €) y por debajo de STEL Business (36 €). El plan anual mejora la caja y reduce el churn.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Qué limitar en Free   | Número de presupuestos o proyectos activos; **estimador público** (Free: hasta 3 solicitudes al mes, o solo con la marca BudGenerator); **Equipo** (Free: 1-2 recursos) | El estimador y el equipo son los diferenciales que justifican el pago. Hay que decidirlo con BG-005 y BG-011.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Precio de lanzamiento | "Socio fundador": 14,99 €/mes de por vida para los primeros 50-100 clientes **[propuesta]**                                                                             | Acelera los primeros testimonios y reduce el riesgo del test                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Plan Equipo (futuro)  | 39-49 €/mes cuando haya cuentas para trabajadores                                                                                                                       | Hoy no existen cuentas para trabajadores (BG-011), así que no conviene lanzarlo todavía                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### 3.3 Lo mínimo imprescindible antes de pagar anuncios

| Área                         | Mínimo                                                                                                                                                                                                                                                                                                                                                                             | Estado según la documentación                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Cobro**                    | Stripe Checkout, portal del cliente, webhooks y degradación (BG-004); IVA y factura de la suscripción resueltos con un asesor                                                                                                                                                                                                                                                      | Aplazado (`docs/plan.md`)                                                                                                  |
| **Landing**                  | Página en la raíz o en un dominio propio con la propuesta, un vídeo o GIF de 30 s, precios, preguntas frecuentes, botón "Empieza gratis" y prueba social real                                                                                                                                                                                                                      | No existe landing comercial (la landing de BG-005 es para las empresas, no para BudGenerator)                              |
| **Onboarding**               | Registro en menos de 60 s (Google o email); asistente que pide el oficio y carga la base de catálogo adecuada; primer presupuesto de ejemplo listo para enviar en menos de 10 minutos; correo o push de seguimiento a las 24 h y a los 3 días                                                                                                                                      | El asistente de creación guiada existe (BG-006 retirado, asistente vigente); falta un onboarding orientado a la activación |
| **Definición de activación** | Por ejemplo: "ha creado y exportado o compartido 1 presupuesto con al menos 3 partidas en 7 días"                                                                                                                                                                                                                                                                                  | Sin definir. **Hay que acordarla.**                                                                                        |
| **Analítica y atribución**   | Meta Pixel y **Conversions API** (servidor, deduplicado por `event_id`) con los eventos `Lead` (landing), `CompleteRegistration`, `StartTrial`, `Activated` (evento personalizado), `Subscribe` o `Purchase` (desde el webhook de Stripe); UTM guardadas en el perfil al registrarse; panel con el embudo por cohorte                                                              | No consta. **PENDIENTE DE CRUZAR**                                                                                         |
| **Legal**                    | Aviso legal (LSSI-CE), política de privacidad (RGPD/LOPDGDD), banner de cookies conforme a la guía de la AEPD (rechazar al mismo nivel que aceptar; el píxel no se activa sin consentimiento), condiciones de contratación y **contrato de encargado del tratamiento (art. 28 RGPD)**: BudGenerator trata los datos de los clientes finales de cada empresa (leads y presupuestos) | No consta. El encargo del tratamiento es crítico por el estimador.                                                         |
| **Soporte**                  | Chat o WhatsApp Business con horario, centro de ayuda con 10 artículos o vídeos, email de soporte y tiempo de respuesta publicado                                                                                                                                                                                                                                                  | No consta                                                                                                                  |
| **Estabilidad**              | Sin incidencias graves en el flujo de registro, presupuesto y PDF en móvil (iOS Safari y Android Chrome)                                                                                                                                                                                                                                                                           | **PENDIENTE DE CRUZAR** con los análisis técnicos                                                                          |

---

## 4. Meta Ads

### 4.1 Idoneidad del canal

- **A favor:** los gremios usan mucho Facebook (grupos de reformistas, autónomos de la construcción, compraventa de herramienta) e Instagram (antes/después). Meta permite segmentar por geografía y comportamiento a coste bajo. El CPM en España está por debajo de la media global: [Superads](https://www.superads.ai/facebook-ads-costs/cpm-cost-per-mille/spain) observa una bajada del 25 % entre octubre de 2024 y septiembre de 2025, y [Adligator](https://adligator.com/es/blog/cpm-facebook-por-pais-2026) estima 5,5-8 $ en Facebook y 7-10 $ en Instagram en 2026. Que Facebook sea el canal dominante del gremio es una **hipótesis basada en observación del sector, no en un dato publicado**.
- **En contra:** no hay intención de compra; el usuario está haciendo _scroll_. La segmentación por intereses B2B es imprecisa (Meta no segmenta bien por profesión). El público tiene menos tolerancia al alta en SaaS. El CPL del software en España está por encima de la media: la mediana de coste por lead en "software development" es 40,71 frente a 35,80 de referencia global ([Superads](https://www.superads.ai/facebook-ads-costs/cost-per-lead/software-development/spain)). Ese dato mide formularios de lead B2B, no altas a una app gratuita, así que solo sirve como cota alta.
- **Conclusión:** Meta es **adecuado para un test de mensaje y adquisición de bajo ticket con producto freemium**. Probablemente no sea el canal más eficiente en CAC. Conviene combinarlo con canales de intención y comunidad (4.6).

### 4.2 Intereses frente a Advantage+

- Con 1.000-3.000 € de presupuesto, **Advantage+ con audiencia amplia** (España, 25-60 años, sin intereses o con intereses como "sugerencia") suele aprender mejor que muchos conjuntos de anuncios pequeños. La creatividad hace de segmentación: un vídeo de "presupuesto de baño en el móvil" filtra por sí solo.
- Mantener **un conjunto de anuncios de control con intereses** (construcción, reformas, fontanería, electricidad, autónomos, Leroy Merlin y similares, administradores de páginas de empresa) para comparar.
- **Exclusiones:** usuarios ya registrados (público personalizado desde la CAPI o una lista) y, si hay volumen, visitantes de la web de los últimos 30 días en prospección.
- Hay que comprobar en Ads Manager que el anuncio no cae en una categoría especial (vivienda). Es software para profesionales, pero la palabra "reforma" podría activar la revisión.

### 4.3 Estructura de la campaña de prueba

| Fase            | Semanas | Objetivo de campaña                                | Evento de optimización                                                 | Conjuntos de anuncios                           | Creatividades                             |
| --------------- | ------- | -------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------- |
| 0. Preparación  | -2 a 0  | —                                                  | Pixel y CAPI verificados en el Administrador de eventos                | —                                               | Grabar 6-8 piezas                         |
| 1. Mensaje      | 1-2     | **Ventas o Clientes potenciales (conversión web)** | `CompleteRegistration`                                                 | 1 Advantage+ amplio y 1 por intereses           | 4-6 anuncios: 3 ángulos × 2 formatos      |
| 2. Optimización | 3-4     | Igual                                              | `CompleteRegistration`; pasar a `Activated` si llega a ~50 a la semana | El ganador y una iteración de creatividades     | Las 2-3 mejores y 2 variantes nuevas      |
| 3. Remarketing  | 2-6     | Ventas                                             | `Subscribe` o `StartTrial`                                             | Registrados no activados, visitantes de precios | Tutorial, testimonio y oferta de fundador |

- **Formulario instantáneo de Meta frente a conversión web:** para un SaaS freemium, la **conversión web hacia el registro** es mejor. El formulario instantáneo da CPL bajos pero con leads de baja calidad que no llegan a usar el producto. Solo tendría sentido como "pídenos una demo por WhatsApp" para el segmento B (empresa con cuadrillas).
- **Fase de aprendizaje:** Meta necesita unos 50 eventos de optimización por conjunto de anuncios en 7 días (guía conocida de Meta, **pendiente de reverificar en su centro de ayuda**). Con presupuestos bajos, optimizar para el registro (frecuente) y no para el pago (raro).

**Creatividades (ángulos que hay que probar):**

1. **Demo real en 15-30 s:** pantalla del móvil, "presupuesto de un baño de 6 m² en 3 minutos". Partidas del catálogo → PDF → enviar por WhatsApp. Sin locución, con subtítulos grandes.
2. **UGC de un reformista real** (piloto o _creator_ del gremio): "antes tardaba una tarde; ahora lo hago en la furgoneta". Solo con un testimonio real y autorizado.
3. **Antes/después del presupuesto:** Excel feo o papel a mano frente al PDF profesional con logo.
4. **Leads propios:** "Deja de pagar por clientes compartidos. Pon este estimador en tu web o en tu Instagram y recibe solicitudes en el móvil." Muestra la notificación push y la solicitud.
5. **Imprevistos:** "el cliente pidió cambiar el plato de ducha; regístralo como suplemento y que no se te olvide cobrarlo".

Formatos: 9:16 para Reels e Historias y 4:5 para el feed. Gancho en los primeros 2 s. Llamada a la acción "Regístrate" y destino a la landing con un parámetro de creatividad en la UTM.

### 4.4 Benchmarks utilizados

| Métrica                   | Valor de referencia                                                                             | Fuente                                                                                                                                                              | Uso en el modelo                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| CPM en España             | 5,5-8 $ (Facebook) / 7-10 $ (Instagram) en 2026; ~9,40 € de CPM medio global en febrero de 2025 | [Adligator](https://adligator.com/es/blog/cpm-facebook-por-pais-2026), [Shopify vía Birch](https://www.shopify.com/es/blog/cuanto-cuestan-los-anuncios-de-facebook) | Pesimista 10 €, base 8 €, optimista 6 €             |
| CPC medio                 | 1,72 $ global; 2,14 $ en servicios industriales                                                 | [Trendtrack](https://www.trendtrack.io/es/blog-post/inversion-publicitaria-meta-por-industria) (mediana de fuentes mixtas, no específica de España)                 | Contraste: el modelo da un CPC de 0,6-1,7 €         |
| CPL de software en España | Mediana 40,71 (formulario de lead B2B)                                                          | [Superads](https://www.superads.ai/facebook-ads-costs/cost-per-lead/software-development/spain)                                                                     | Cota alta del escenario pesimista                   |
| Freemium a pago           | 2-5 % SMB; media del 3,7 %                                                                      | [Userpilot](https://userpilot.com/blog/freemium-saas/), [Crazy Egg / First Page Sage](https://www.crazyegg.com/blog/free-to-paid-conversion-rate/?pp=iaqb)          | 2 / 4 / 7 %                                         |
| Prueba _opt-in_ a pago    | ~17-18 %                                                                                        | [Crazy Egg / First Page Sage](https://www.crazyegg.com/blog/free-to-paid-conversion-rate/?pp=iaqb)                                                                  | Sobre los activados, si se adopta la prueba inversa |
| Churn mensual SMB         | 3-7 %; mediana del 4,7 %                                                                        | [UserJot](https://userjot.com/blog/saas-churn-rate-benchmarks), [Vena](https://venasolutions.com/blog/saas-churn-rate)                                              | 6 / 4,5 / 3 %                                       |

Los CTR, la conversión de la landing y la activación **no tienen un benchmark fiable** para este nicho. Uso **[Estimación]** con rangos prudentes y el test los sustituye.

### 4.5 Presupuesto de test y embudo estimado

**Supuestos [Estimación]:**

| Supuesto                    | Pesimista | Base  | Optimista |
| --------------------------- | --------- | ----- | --------- |
| CPM                         | 10 €      | 8 €   | 6 €       |
| CTR del enlace              | 0,6 %     | 1,0 % | 1,5 %     |
| Clic → registro (landing)   | 4 %       | 8 %   | 12 %      |
| Registro → activado         | 25 %      | 40 %  | 55 %      |
| Registro → pago (a 60 días) | 2 %       | 4 %   | 7 %       |

De ahí salen un CPC de 1,67 / 0,80 / 0,40 € y un coste por registro (CPL) de 41,7 / 10 / 3,3 €. El caso pesimista coincide con el CPL de software de Superads, lo que da cierta coherencia al rango.

**Embudo por escenario (caso base, con el rango pesimista–optimista entre paréntesis):**

| Escenario   | Duración    | Impresiones               | Clics               | Registros    | Activados    | Pagos     | CAC (pago)                |
| ----------- | ----------- | ------------------------- | ------------------- | ------------ | ------------ | --------- | ------------------------- |
| **300 €**   | 4 semanas   | 37.500 (30.000–50.000)    | 375 (180–750)       | 30 (7–90)    | 12 (2–50)    | ~1 (0–6)  | ~250 € (no significativo) |
| **1.000 €** | 4-6 semanas | 125.000 (100.000–167.000) | 1.250 (600–2.500)   | 100 (24–300) | 40 (6–165)   | 4 (0–21)  | **~250 €** (∞–48 €)       |
| **3.000 €** | 6 semanas   | 375.000 (300.000–500.000) | 3.750 (1.800–7.500) | 300 (72–900) | 120 (18–495) | 12 (1–63) | **~250 €** (2.083–48 €)   |

Notas:

- Con 300 € el número de pagos no permite conclusiones. Sirve para **CTR, CPC, coste por registro y ganador de creatividad**.
- Al escalar a 3.000 € el CPM suele subir por saturación. El modelo no lo incluye, así que el caso base de 3.000 € es algo optimista.
- Los pagos llegan con retraso (prueba de 14 días y uso de varias semanas). Medir el CAC con **ventanas de cohorte de 30 y 60 días**.

**LTV necesario [Estimación]:**

- Ingreso neto mensual ≈ 19,99 € – comisión de Stripe (~1,5 % + 0,25 € en tarjetas EEE, **pendiente de confirmar en la tarifa vigente de Stripe España**) – costes de infraestructura por cuenta (desconocidos; **PENDIENTE DE CRUZAR**). Supongo un margen bruto de ~85 % (~17 €/mes).
- Con churn del 6 / 4,5 / 3 %, la vida media es de 17 / 22 / 33 meses, y el **LTV bruto ≈ 290 / 380 / 570 €**.
- **CAC máximo:** con LTV:CAC ≥ 3 queda en **~95-190 €**. Con una recuperación en menos de 12 meses, en **~200 €**.
- **Conclusión:** el caso base (CAC ~250 €) **no es rentable todavía**. Es viable si se mejora una de dos palancas: (a) la conversión a pago hasta el 6-8 % (prueba inversa, límite de Free bien colocado, oferta de fundador) o (b) el coste por registro por debajo de ~6 € (creatividad ganadora y landing optimizada). Con el plan anual (199 €) se adelanta caja y el churn efectivo baja.

### 4.6 Criterios de éxito y de parada

**Parada por creatividad** (tras unas 3.000-5.000 impresiones por anuncio): CTR del enlace < 0,6 %, o CPC > 1,50 €. Se apaga la creatividad.

**Parada del test de 1.000 €**, si se cumple cualquiera:

- Coste por registro > 25 € tras gastar 500 €.
- Activación < 20 % de los registrados de Meta (el canal trae curiosos y no profesionales).
- 0 pagos a los 45 días de la primera cohorte con 80 o más registros.

**Éxito para escalar a 3.000 €:**

- Coste por registro ≤ 12 €.
- Activación ≥ 35 %.
- Pago ≥ 4 % a 45-60 días, o prueba inversa con conversión ≥ 10 % de los activados.
- CAC proyectado ≤ 200 €.

**Éxito para invertir de forma continua** (más de 1.500 €/mes): CAC ≤ 150 €, churn del primer mes ≤ 8 %, y el 30 % de los pagos con plan anual o en segundo mes.

### 4.7 Canales alternativos o complementarios (más baratos)

| Canal                             | Por qué                                                                           | Acción concreta                                                                                                                                                                                                      | Coste                                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Grupos de Facebook del gremio** | Comunidad con dolor visible ("¿cómo presupuestáis…?")                             | Aportar valor con plantillas de partidas o una calculadora; contacto 1:1; respetar las normas de cada grupo (sin spam)                                                                                               | Tiempo                                                                                                               |
| **YouTube y TikTok orgánico**     | Búsquedas tipo "cómo hacer un presupuesto de reforma"                             | 1-2 vídeos por semana: tutorial de presupuesto de baño o cocina, precios orientativos por m² y errores típicos                                                                                                       | Tiempo y producción                                                                                                  |
| **SEO local y de plantilla**      | Intención alta: "plantilla presupuesto reforma", "presupuesto reforma baño excel" | Plantillas descargables (Excel/PDF) que llevan al registro; generador gratuito como hace [Billin](https://www.billin.net/generadores/generador-presupuestos-reformas-instalaciones-hogar/); páginas por oficio       | Tiempo; resultados en 3-9 meses                                                                                      |
| **Google Ads de intención**       | Alta intención ("programa presupuestos reformas", "app presupuestos obra")        | Campaña de búsqueda con concordancia de frase, 10-20 €/día y presupuesto acotado                                                                                                                                     | CPC desconocido para el nicho **[Estimación: probablemente 1-3 €, verificar con el Planificador de palabras clave]** |
| **Asociaciones y gremios**        | Confianza y descuentos para socios                                                | Gremios provinciales de construcción y reformas, asociaciones de instaladores (FENIE en electricidad, CONAIF en fontanería y climatización) y asociaciones de autónomos (ATA, UPTA): webinar y descuento para socios | Bajo; ciclo lento                                                                                                    |
| **Distribuidores de material**    | El reformista va a diario al almacén                                              | Acuerdo con almacenes locales o cadenas profesionales: cartel o QR, demo en tienda, catálogo con sus precios precargado                                                                                              | Bajo-medio                                                                                                           |
| **Viralidad del producto**        | Cada PDF y cada estimador se ven por clientes finales y otros gremios             | Marca "Hecho con BudGenerator" en Free y programa de referidos (1 mes gratis por alta de pago)                                                                                                                       | Casi nulo                                                                                                            |
| **Gestorías**                     | Recomiendan software a los autónomos                                              | Programa de partners y contenido sobre VeriFactu para reformistas                                                                                                                                                    | Bajo                                                                                                                 |

---

## 5. Veredicto de viabilidad

### 5.1 Veredicto

**Viable con condiciones.** El producto tiene diferenciales claros (estimador con leads propios, catálogo de partidas en el móvil, proyectos y equipo) y el mercado es amplio y poco servido en el punto "autónomo de reformas y móvil". Las condiciones son:

1. Implementar cobro, legal y analítica (sección 3.3).
2. Validar el dolor y la disposición a pagar con 10-15 entrevistas y 5-10 usuarios piloto.
3. Usar Meta como **canal de aprendizaje y volumen**, con un CAC objetivo de 150 € o menos, y apoyarse en canales orgánicos y de intención para bajar el CAC combinado.

Sin esas condiciones, gastar en anuncios es quemar dinero sin poder medir el retorno.

### 5.2 Escenarios a 12 meses [Estimación]

Supuestos comunes: el lanzamiento comercial es en el mes 3. Hay 9 meses de captación, precio medio de 19,99 € al mes y, en los tres escenarios, alrededor del 30 % de los registros llega por canales orgánicos.

| Escenario     | Registros al mes (de pago y orgánicos) | Conversión a pago | Churn mensual | Clientes de pago en el mes 12 | MRR en el mes 12 | Inversión en Meta               |
| ------------- | -------------------------------------- | ----------------- | ------------- | ----------------------------- | ---------------- | ------------------------------- |
| **Pesimista** | 60                                     | 2,5 %             | 6 %           | ~11                           | ~220 €           | ~3.000 € (se para tras el test) |
| **Base**      | 150                                    | 5 %               | 4,5 %         | ~55                           | ~1.100 €         | ~9.000 € (1.000 €/mes)          |
| **Optimista** | 400                                    | 7 %               | 3 %           | ~215                          | ~4.300 €         | ~18.000 € (2.000 €/mes)         |

Los clientes del mes 12 son el resultado aproximado de 9 cohortes mensuales menos el churn acumulado. Es un cálculo propio y simplificado.

**Lectura:** solo el optimista cubre una dedicación parcial con margen. El escenario base valida el producto y justifica seguir, pero no paga la inversión en anuncios en 12 meses (recuperación de unos 18-24 meses). El pesimista indica que hay que cambiar el segmento, el precio o el canal.

### 5.3 Riesgos

| Riesgo                                                                                   | Probabilidad | Impacto | Mitigación                                                                                                |
| ---------------------------------------------------------------------------------------- | ------------ | ------- | --------------------------------------------------------------------------------------------------------- |
| El usuario quiere presupuestar y facturar en el mismo sitio                              | Alta         | Alta    | Integración o exportación hacia herramientas con VeriFactu; mensaje "complementa tu programa de facturas" |
| Meta trae registros sin activar (curiosos o no profesionales)                            | Media-alta   | Media   | Optimizar hacia la activación, cualificar en la landing ("¿a qué te dedicas?") y en el onboarding         |
| Competidor con distribución (Billin, Holded, STEL) añade partidas o un estimador         | Media        | Alta    | Velocidad en el nicho, comunidad gremial y el diferencial del estimador y los leads                       |
| Incumplimiento de RGPD o cookies (píxel sin consentimiento, sin encargo del tratamiento) | Media        | Alta    | Legal antes del test; CAPI con consentimiento                                                             |
| Estabilidad o rendimiento en móviles de gama baja                                        | Desconocida  | Alta    | **PENDIENTE DE CRUZAR**                                                                                   |
| Costes de Firebase con más uso (Functions del estimador)                                 | Baja-media   | Media   | Alertas de gasto y límites (ya previsto en BG-005)                                                        |
| Dependencia de una sola persona para soporte y desarrollo                                | Alta         | Media   | Centro de ayuda, plantillas de respuesta y horario de soporte acotado                                     |
| Cambio normativo (VeriFactu o factura electrónica) que empuja a suites "todo en uno"     | Media        | Media   | Ventana de oportunidad si existe la integración                                                           |

---

## 6. Plan de lanzamiento (12 semanas)

| Semana   | Objetivo                                                                                  | Entregables                                                                                                                                                              | Criterio para avanzar                                                                                 |
| -------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **1**    | Validación cualitativa                                                                    | 10-15 entrevistas a reformistas (grupos de Facebook, contactos, almacenes); guion sobre cómo presupuestan hoy, cuánto tardan, cuánto pagan por leads y qué software usan | ≥ 60 % reconoce el dolor y ≥ 30 % diría que pagaría ~20 €/mes                                         |
| **2**    | Decisiones de producto                                                                    | Definición de la activación; límites de Free (BG-004, BG-005, BG-011); decisión sobre la prueba inversa; precio de fundador                                              | Decisiones escritas en las specs                                                                      |
| **2-4**  | Cobro                                                                                     | BG-004: Stripe Checkout, portal, webhooks y degradación, con pruebas de emulador; configuración fiscal revisada con un asesor                                            | Pago real de prueba de punta a punta en _staging_                                                     |
| **3-4**  | Legal                                                                                     | Aviso legal, privacidad, cookies (AEPD), condiciones y contrato de encargado del tratamiento                                                                             | Revisión por un profesional                                                                           |
| **3-5**  | Analítica                                                                                 | Pixel y CAPI con deduplicación, UTM en el perfil, eventos del embudo y panel de cohortes                                                                                 | Eventos visibles y deduplicados en el Administrador de eventos                                        |
| **4-5**  | Landing y onboarding                                                                      | Landing con vídeo, precios y preguntas frecuentes; onboarding por oficio; secuencia de correo o push (día 0, 1, 3 y 7); centro de ayuda mínimo                           | Usuario nuevo con su primer PDF en menos de 10 minutos (probado con 5 personas)                       |
| **5-6**  | Piloto                                                                                    | 5-10 reformistas con precio de fundador; recogida de testimonios y vídeo UGC                                                                                             | ≥ 3 testimonios reales autorizados                                                                    |
| **6**    | Producción de creatividades                                                               | 6-8 piezas: demo, UGC, antes/después, leads propios e imprevistos                                                                                                        | —                                                                                                     |
| **7-8**  | **Test de Meta de 300 €** (mensaje) + orgánico (grupos, 2 vídeos, 2 artículos SEO)        | Ganador de creatividad y ángulo                                                                                                                                          | CTR ≥ 0,8 % y coste por registro ≤ 15 €                                                               |
| **8-11** | **Test de Meta de 1.000 €** + remarketing; Google Ads de intención con 300 € como control | Cohortes con activación y primeros pagos                                                                                                                                 | Criterios de la sección 4.6                                                                           |
| **12**   | Decisión                                                                                  | Informe de CAC, activación, pago, churn temprano y feedback                                                                                                              | Escalar a 3.000 €, iterar (precio, segmento, onboarding) o pivotar el canal hacia orgánico y partners |

---

## 7. Dependencias técnicas

Supuestos cruzados el 11-11-2026 con los análisis técnicos: [frontend](frontend-pwa.md), [backend](backend.md), [arquitectura IA](ai-architecture.md) y [app nativa](native-app-plan.md). Mientras haya filas en **No cumple**, el plan de la sección 6 no debe pasar a la fase de anuncios.

| Área                            | Supuesto                                                                                         | Estado tras cruzar        | Evidencia y acción                                                                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estabilidad**                 | El flujo registro → presupuesto → PDF → compartir es fiable en iOS y Android con carga aceptable | **Parcial**               | La CI de `main` lleva rota desde el 18-10-2026 y se ha desplegado con tests en rojo. El login carga unos 913 KB de JS. Falta verificar en una PWA física de iOS. Acción: fase 0 del backend (arreglar la CI) y reducir la carga inicial (frontend, sección 8). |
| **Estabilidad (carga y coste)** | La plataforma aguanta cientos de altas al mes sin costes inesperados y hay alertas               | **No cumple**             | Un único proyecto Firebase para pruebas y producción, sin alertas de gasto, PITR ni backups. Sin App Check ni verificación de email, y el estimador público admite 240 leads al día por token. Acción: fases 0 y 1 del backend antes de pagar tráfico.         |
| **Cobro**                       | BG-004 con Stripe es viable en 2-3 semanas                                                       | **No cumple (aplazado)**  | No hay Stripe. Los planes son manuales y el límite de Free es acumulado. El plan del backend no incluye cobro, así que hay que añadirlo como trabajo propio con webhooks en Functions.                                                                         |
| **Cobro (prueba inversa)**      | Prueba Pro de 14 días en el esquema de derechos                                                  | **Pendiente de decisión** | Contradice BG-004 (sin prueba). Técnicamente encaja si el plan pasa a _custom claims_ o campo validado en servidor, como propone el backend (fase 2).                                                                                                          |
| **Analítica**                   | Meta Pixel con consentimiento y Conversions API desde Functions                                  | **No cumple**             | No hay analítica ni gestor de consentimiento en el código. Hace falta un banner de cookies, el Pixel tras consentimiento y CAPI en una Function con `event_id` compartido.                                                                                     |
| **Analítica de producto**       | Medición de activación por cohorte                                                               | **No cumple**             | No hay eventos de producto. Mínimo: registro, primer presupuesto, primer PDF o compartido y estimador publicado.                                                                                                                                               |
| **App nativa**                  | La PWA basta para las primeras 12 semanas                                                        | **Cumple, con matices**   | La PWA, el SW y el push web funcionan. En iOS, el push del estimador exige instalarla, y no hay splash screens. La app nativa (19-25 semanas) no bloquea el test de Meta.                                                                                      |
| **Onboarding**                  | Catálogo base por oficio y presupuesto de ejemplo                                                | **Parcial**               | Hay 21 catálogos base y un tour de bienvenida (`features/app-tour`). No hay presupuesto de ejemplo ni landing.                                                                                                                                                 |
| **Marca en el PDF y referidos** | Marca "Hecho con BudGenerator" en Free                                                           | **Viable**                | El PDF se genera en cliente con jsPDF (`docs/pdf-export.md`), así que es un cambio acotado.                                                                                                                                                                    |
| **Legal y datos**               | Exportar y borrar datos a petición, y consentimiento en el estimador                             | **No cumple**             | No hay borrado ni exportación de cuenta, ni retención de leads. Los enlaces compartidos caducados no se borran y el registro no enlaza textos legales. Acción: fase 2 del backend (borrado, TTL y retención) y textos legales en registro y estimador.         |

**Conclusión del cruce:** antes del test de 1.000 € hay que completar, por este orden: CI en verde, separar staging de producción con alertas de gasto y backups, App Check y límites del estimador, textos legales y borrado de cuenta, Stripe, y analítica con consentimiento. La estimación es de 6 a 9 semanas para una persona. Encaja con las 6-8 semanas de preparación de la sección 6, sin margen.

---

## 8. Fuentes

- INE, DIRCE 2025: https://www.ine.es/dyngs/Prensa/es/DIRCE2025.htm
- IPYME, Retrato PYME DIRCE 2024: https://ipyme.org/Publicaciones/Retrato%20de%20la%20PYME/Retrato_Pyme_DIRCE_2024.pdf
- UPTA, afiliación de autónomos, 1.er semestre 2025: https://upta.es/wp-content/uploads/2025/07/UPTA_Informe-afiliacion-autonomos-primer-semestre-2025.pdf
- Observatorio de autónomos de la CARM, enero 2026: https://autonomos.carm.es/documents/d/guest/2026-1-observatrio-enero
- CIO España, Década Digital 2025 (ONTSI): https://www.cio.com/article/4039919/decada-digital-2025-en-espana-aprobado-en-infraestructura-digital-necesita-mejorar-en-pymes.html
- Holded, autónomos e IA: https://www.holded.com/es/blog/ia-autonomos
- VeriFactu 2027 (RDL 15/2025): https://getquipu.com/blog/verifactu-se-retrasa/ · https://www.billin.net/blog/hacienda-retrasa-verifactu-a-2027/
- VeriFactu, anuncio de aplazamiento a octubre de 2028: https://www.fieldfisher.com/es-es/locations/espana/actualidad/verifactu-aplazamiento-octubre-2028 · https://getrenn.com/es/blog/verifactu-aplazado · https://emprendedores.es/gestion/aplazamiento-verifactu-2028/
- Billin, precios: https://www.billin.net/precios/ · generador de reformas: https://www.billin.net/generadores/generador-presupuestos-reformas-instalaciones-hogar/
- Precios de Holded: https://www.guiadesoftware.com/software/holded · https://finom.co/es-es/blog/holded-precios/
- Quipu y Contasimple: https://guiafiscal.es/comparativas/quipu-opiniones/ · https://guiafiscal.es/comparativas/mejor-programa-facturacion-autonomos/
- STEL Order: https://hackceleration.com/es/labs/cambiar/stel-order · https://www.stelorder.com/blog/mejores-programas-presupuestos-de-obra/
- Presto y Arquímedes: https://oneestimate.ai/es/comparar/oneestimate-vs-presto · https://www.capterra.es/software/193000/presto · https://hackceleration.com/es/labs/mejor/programa-presupuestos-obra · https://www.zaragoza.es/web/hacienda-economia/servicio/factura/proveedor/11662
- Software de nicho de reformas: https://hackceleration.com/es/labs/mejor/programa-presupuestos-autonomos · https://www.capterra.es/software/1098825/Motor-de-Presupuestos · https://www.softwaredoit.es/software-construccion/presupuestos-gestion-obras-reformas.html
- Habitissimo y Cronoshare: https://www.habitissimo.es/ · https://www.cronoshare.com/comunidad/comparativas/cronoshare-vs-habitissimo-espana · https://www.cronoshare.com/presupuesto-reforma-integral-vivienda-lleida-lleida-tarea-4465748-web
- CPM, CPC y CPL de Meta: https://adligator.com/es/blog/cpm-facebook-por-pais-2026 · https://www.superads.ai/facebook-ads-costs/cpm-cost-per-mille/spain · https://www.superads.ai/facebook-ads-costs/cost-per-lead/software-development/spain · https://www.trendtrack.io/es/blog-post/inversion-publicitaria-meta-por-industria · https://www.shopify.com/es/blog/cuanto-cuestan-los-anuncios-de-facebook
- Conversión freemium y de prueba: https://userpilot.com/blog/freemium-saas/ · https://www.crazyegg.com/blog/free-to-paid-conversion-rate/?pp=iaqb · https://chartmogul.com/reports/saas-conversion-report/
- Churn SMB: https://userjot.com/blog/saas-churn-rate-benchmarks · https://venasolutions.com/blog/saas-churn-rate

## 9. Pendientes de verificación

- Confirmar en el BOE si el aplazamiento de VeriFactu a octubre de 2028 está publicado.
- Confirmar con un asesor fiscal que un software solo de presupuestos no es un sistema informático de facturación.
- Precios oficiales vigentes de Holded, Quipu, STEL Order, Presto y Arquímedes, y la tarifa de Habitissimo para profesionales en España.
- Tarifa vigente de Stripe en España y coste de Firebase por cuenta activa.
- CPC real de Google Ads para palabras clave de intención, con el Planificador de palabras clave.
- Umbral actual de la fase de aprendizaje de Meta y si los anuncios caen en una categoría especial.
- Dolor y disposición a pagar: entrevistas de la semana 1. Hoy no hay investigación de usuarios documentada.
