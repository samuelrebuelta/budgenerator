# Catálogo de importaciones — Reforma integral

**Estado:** aprobado por el usuario el 19-10-2026 para reemplazar la biblioteca antigua de importaciones.

## Objetivo

Ofrecer una biblioteca maestra para presupuestar reformas residenciales, con todos los gremios habituales agrupados en partidas. El usuario puede importar la biblioteca completa, una partida o conceptos seleccionados desde el importador existente.

## Partidas aprobadas

En orden alfabético:

1. Accesibilidad
2. Albañilería
3. Aislamiento
4. Carpintería
5. Cerrajería
6. Cimentación
7. Climatización
8. Cocinas
9. Cubiertas
10. Demolición
11. Electricidad
12. Enlucidos
13. Energía solar
14. Estructura
15. Exteriores
16. Fachadas
17. Fontanería
18. Gas
19. Jardinería
20. Limpieza
21. Mudanzas
22. Pavimentos
23. Pintura
24. Piscinas
25. Pladur
26. Revestimientos
27. Telecomunicaciones
28. Varios
29. Ventanas
30. Vidrio

La partida **Electricidad** reúne cableado, canalizaciones, circuitos, cuadros, protecciones, toma de tierra, enchufes, interruptores, puntos de luz y luminarias. **Telecomunicaciones** agrupa red, TV, fibra, portero, seguridad y domótica. **Varios** incluye visita técnica, mediciones, licencias y tasas, andamios, protección de suelos y mobiliario, limpieza final de obra y mano de obra general. **Limpieza** queda para servicios periódicos, limpieza profunda, cristales, pulido, desinfección y plagas.

## Decisiones de implementación

- Sustituir las bases importables antiguas por una única biblioteca «Reforma integral» con las 30 partidas aprobadas.
- Reutilizar la vista actual de detalle e importación granular por partida o concepto.
- Usar unidades existentes (`m2`, `m3`, `ml`, `unit`, `hour`) según el tipo de trabajo.
- No inventar precios: los conceptos de la biblioteca parten con `basePrice: 0` y `cost: 0`, editables por cada empresa.
- Usar la nueva biblioteca como semilla para una cuenta que todavía no tenga catálogo ni tarifas previas.
- La importación existente sigue fusionando por nombre de partida y descripción/unidad, sin duplicar conceptos ni reemplazar valores personalizados.
- No migrar, vaciar ni cambiar automáticamente catálogos privados ya guardados, presupuestos o plantillas.

## Fuera de alcance

No se añaden precios de mercado, unidades fuera del modelo actual, dependencias, categorías por habitación ni migraciones de datos de cuentas existentes.
