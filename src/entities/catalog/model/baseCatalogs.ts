import type { Tariff } from '@/shared/types';

export interface BaseCatalog {
  id: string;
  name: string;
  description: string;
  tariffs: Omit<Tariff, 'id'>[];
}

export const BASE_CATALOGS: BaseCatalog[] = [
  {
    id: 'en_blanco',
    name: 'En blanco',
    description: 'Catálogo vacío para empezar desde cero',
    tariffs: [],
  },
  {
    id: 'reformas_integrales',
    name: 'Reformas integrales',
    description: 'Catálogo completo de servicios de reforma integral',
    tariffs: [
      // Demolición
      { description: 'Demolición y retirada de escombros', unit: 'm2', basePrice: 20, cost: 12, category: 'Demolición' },
      { description: 'Demolición de tabique', unit: 'm2', basePrice: 18, cost: 10, category: 'Demolición' },
      { description: 'Levantado de solado existente', unit: 'm2', basePrice: 15, cost: 9, category: 'Demolición' },
      { description: 'Levantado de alicatado existente', unit: 'm2', basePrice: 14, cost: 8, category: 'Demolición' },
      { description: 'Desmontaje de sanitarios', unit: 'unit', basePrice: 45, cost: 25, category: 'Demolición' },
      { description: 'Desmontaje de muebles de cocina', unit: 'ml', basePrice: 30, cost: 18, category: 'Demolición' },
      { description: 'Contenedor de escombros (6m³)', unit: 'unit', basePrice: 280, cost: 180, category: 'Gestión de residuos' },

      // Albañilería
      { description: 'Enlucido de paredes', unit: 'm2', basePrice: 25, cost: 14, category: 'Albañilería' },
      { description: 'Enfoscado de cemento', unit: 'm2', basePrice: 20, cost: 12, category: 'Albañilería' },
      { description: 'Guarnecido y enlucido de yeso', unit: 'm2', basePrice: 18, cost: 10, category: 'Albañilería' },
      { description: 'Recrecido de suelo (mortero)', unit: 'm2', basePrice: 16, cost: 9, category: 'Albañilería' },

      // Tabiquería
      { description: 'Tabique de pladur (15cm)', unit: 'm2', basePrice: 45, cost: 28, category: 'Tabiquería' },
      { description: 'Tabique de ladrillo hueco sencillo', unit: 'm2', basePrice: 30, cost: 18, category: 'Tabiquería' },

      // Suelos
      { description: 'Colocación de suelo cerámico', unit: 'm2', basePrice: 35, cost: 20, category: 'Suelos' },
      { description: 'Instalación de tarima flotante', unit: 'm2', basePrice: 28, cost: 16, category: 'Suelos' },
      { description: 'Instalación de parquet', unit: 'm2', basePrice: 55, cost: 35, category: 'Suelos' },

      // Alicatado
      { description: 'Alicatado de paredes', unit: 'm2', basePrice: 30, cost: 17, category: 'Alicatado' },
      { description: 'Alicatado de gres porcelánico', unit: 'm2', basePrice: 38, cost: 22, category: 'Alicatado' },

      // Pintura
      { description: 'Pintura interior (2 manos)', unit: 'm2', basePrice: 15, cost: 8, category: 'Pintura' },
      { description: 'Pintura de techos', unit: 'm2', basePrice: 14, cost: 7, category: 'Pintura' },
      { description: 'Pintura exterior (fachada)', unit: 'm2', basePrice: 20, cost: 12, category: 'Pintura' },

      // Electricidad
      { description: 'Punto de luz sencillo', unit: 'unit', basePrice: 85, cost: 50, category: 'Electricidad' },
      { description: 'Punto de enchufe', unit: 'unit', basePrice: 75, cost: 42, category: 'Electricidad' },
      { description: 'Cuadro eléctrico completo', unit: 'unit', basePrice: 650, cost: 380, category: 'Electricidad' },

      // Fontanería
      { description: 'Punto de agua sencillo', unit: 'unit', basePrice: 65, cost: 38, category: 'Fontanería' },
      { description: 'Cambio de tuberías (ml)', unit: 'ml', basePrice: 40, cost: 25, category: 'Fontanería' },

      // Sanitarios
      { description: 'Inodoro completo', unit: 'unit', basePrice: 180, cost: 100, category: 'Sanitarios' },
      { description: 'Lavabo completo', unit: 'unit', basePrice: 140, cost: 80, category: 'Sanitarios' },
      { description: 'Bañera con mampara', unit: 'unit', basePrice: 350, cost: 200, category: 'Sanitarios' },

      // Carpintería
      { description: 'Puerta interior', unit: 'unit', basePrice: 120, cost: 65, category: 'Carpintería' },
      { description: 'Puerta exterior', unit: 'unit', basePrice: 220, cost: 130, category: 'Carpintería' },

      // Varios
      { description: 'Mano de obra (hora)', unit: 'hour', basePrice: 45, cost: 25, category: 'Varios' },
    ],
  },

  {
    id: 'albanileria',
    name: 'Albañilería',
    description: 'Servicios de albañilería y obra gruesa',
    tariffs: [
      { description: 'Demolición y retirada de escombros', unit: 'm2', basePrice: 20, cost: 12, category: 'Demolición' },
      { description: 'Demolición de tabique', unit: 'm2', basePrice: 18, cost: 10, category: 'Demolición' },
      { description: 'Levantado de solado existente', unit: 'm2', basePrice: 15, cost: 9, category: 'Demolición' },
      { description: 'Desmontaje de sanitarios', unit: 'unit', basePrice: 45, cost: 25, category: 'Demolición' },

      { description: 'Enlucido de paredes', unit: 'm2', basePrice: 25, cost: 14, category: 'Albañilería' },
      { description: 'Enfoscado de cemento', unit: 'm2', basePrice: 20, cost: 12, category: 'Albañilería' },
      { description: 'Guarnecido y enlucido de yeso', unit: 'm2', basePrice: 18, cost: 10, category: 'Albañilería' },
      { description: 'Recrecido de suelo (mortero)', unit: 'm2', basePrice: 16, cost: 9, category: 'Albañilería' },
      { description: 'Formación de rozas', unit: 'ml', basePrice: 8, cost: 4, category: 'Albañilería' },
      { description: 'Apertura de hueco en muro', unit: 'unit', basePrice: 350, cost: 200, category: 'Albañilería' },

      { description: 'Tabique de ladrillo hueco sencillo', unit: 'm2', basePrice: 30, cost: 18, category: 'Tabiquería' },
      { description: 'Tabique de ladrillo hueco doble', unit: 'm2', basePrice: 38, cost: 22, category: 'Tabiquería' },

      { description: 'Solera de hormigón (10cm)', unit: 'm2', basePrice: 30, cost: 18, category: 'Suelos' },

      { description: 'Reparación de cubierta de teja', unit: 'm2', basePrice: 55, cost: 35, category: 'Tejado' },
      { description: 'Impermeabilización de cubierta', unit: 'm2', basePrice: 40, cost: 25, category: 'Tejado' },

      { description: 'Mano de obra (hora)', unit: 'hour', basePrice: 45, cost: 25, category: 'Varios' },
    ],
  },

  {
    id: 'pintura',
    name: 'Pintura',
    description: 'Servicios de pintura y revestimientos',
    tariffs: [
      { description: 'Preparación de superficies', unit: 'm2', basePrice: 8, cost: 4, category: 'Preparación' },
      { description: 'Pintura interior (2 manos)', unit: 'm2', basePrice: 15, cost: 8, category: 'Pintura interior' },
      { description: 'Pintura interior (3 manos)', unit: 'm2', basePrice: 18, cost: 10, category: 'Pintura interior' },
      { description: 'Pintura de techos', unit: 'm2', basePrice: 14, cost: 7, category: 'Pintura interior' },
      { description: 'Pintura exterior (fachada)', unit: 'm2', basePrice: 20, cost: 12, category: 'Pintura exterior' },
      { description: 'Pintura exterior (fachada técnica)', unit: 'm2', basePrice: 28, cost: 16, category: 'Pintura exterior' },
      { description: 'Lacado de puertas', unit: 'unit', basePrice: 120, cost: 65, category: 'Especiales' },
      { description: 'Pintura epoxi (suelos)', unit: 'm2', basePrice: 25, cost: 14, category: 'Especiales' },
      { description: 'Papel pintado', unit: 'm2', basePrice: 22, cost: 12, category: 'Revestimientos' },
      { description: 'Revestimiento de microcemento', unit: 'm2', basePrice: 70, cost: 42, category: 'Revestimientos' },
      { description: 'Mano de obra (hora)', unit: 'hour', basePrice: 35, cost: 20, category: 'Varios' },
    ],
  },

  {
    id: 'electricidad',
    name: 'Electricidad',
    description: 'Instalaciones y servicios eléctricos',
    tariffs: [
      { description: 'Punto de luz sencillo', unit: 'unit', basePrice: 85, cost: 50, category: 'Iluminación' },
      { description: 'Punto de luz conmutado', unit: 'unit', basePrice: 110, cost: 65, category: 'Iluminación' },
      { description: 'Spot empotrado', unit: 'unit', basePrice: 95, cost: 55, category: 'Iluminación' },
      { description: 'Punto de enchufe', unit: 'unit', basePrice: 75, cost: 42, category: 'Enchufes' },
      { description: 'Punto de enchufe doble', unit: 'unit', basePrice: 95, cost: 55, category: 'Enchufes' },
      { description: 'Enchufe especializado (cocina)', unit: 'unit', basePrice: 120, cost: 70, category: 'Enchufes' },
      { description: 'Cuadro eléctrico completo', unit: 'unit', basePrice: 650, cost: 380, category: 'Cuadros' },
      { description: 'Línea eléctrica independiente', unit: 'unit', basePrice: 180, cost: 100, category: 'Circuitos' },
      { description: 'Toma de TV/datos', unit: 'unit', basePrice: 70, cost: 40, category: 'Telecomunicaciones' },
      { description: 'Cableado estructurado (red)', unit: 'unit', basePrice: 95, cost: 55, category: 'Telecomunicaciones' },
      { description: 'Mano de obra (hora)', unit: 'hour', basePrice: 50, cost: 28, category: 'Varios' },
    ],
  },

  {
    id: 'fontaneria',
    name: 'Fontanería',
    description: 'Instalaciones de fontanería y agua',
    tariffs: [
      { description: 'Punto de agua sencillo', unit: 'unit', basePrice: 65, cost: 38, category: 'Puntos de agua' },
      { description: 'Punto de agua con válvula', unit: 'unit', basePrice: 85, cost: 50, category: 'Puntos de agua' },
      { description: 'Cambio de tuberías (cobre)', unit: 'ml', basePrice: 40, cost: 25, category: 'Tuberías' },
      { description: 'Cambio de tuberías (PVC)', unit: 'ml', basePrice: 30, cost: 18, category: 'Tuberías' },
      { description: 'Cambio de tuberías (multicapa)', unit: 'ml', basePrice: 35, cost: 22, category: 'Tuberías' },
      { description: 'Inodoro completo', unit: 'unit', basePrice: 180, cost: 100, category: 'Sanitarios' },
      { description: 'Lavabo completo', unit: 'unit', basePrice: 140, cost: 80, category: 'Sanitarios' },
      { description: 'Bañera con mampara', unit: 'unit', basePrice: 350, cost: 200, category: 'Sanitarios' },
      { description: 'Ducha completa', unit: 'unit', basePrice: 280, cost: 160, category: 'Sanitarios' },
      { description: 'Grifería de cocina', unit: 'unit', basePrice: 120, cost: 70, category: 'Grifería' },
      { description: 'Grifería de baño', unit: 'unit', basePrice: 100, cost: 60, category: 'Grifería' },
      { description: 'Mano de obra (hora)', unit: 'hour', basePrice: 50, cost: 28, category: 'Varios' },
    ],
  },

  {
    id: 'climatizacion',
    name: 'Climatización',
    description: 'Sistemas de calefacción y refrigeración',
    tariffs: [
      { description: 'Radiador de aluminio', unit: 'unit', basePrice: 120, cost: 70, category: 'Radiadores' },
      { description: 'Instalación de radiador', unit: 'unit', basePrice: 85, cost: 50, category: 'Radiadores' },
      { description: 'Caldera de gas (instalación)', unit: 'unit', basePrice: 450, cost: 270, category: 'Calderas' },
      { description: 'Caldera de condensación', unit: 'unit', basePrice: 650, cost: 380, category: 'Calderas' },
      { description: 'Aire acondicionado (instalación)', unit: 'unit', basePrice: 350, cost: 200, category: 'Aire acondicionado' },
      { description: 'Conducto de aire (ml)', unit: 'ml', basePrice: 45, cost: 28, category: 'Conductos' },
      { description: 'Termostato inteligente', unit: 'unit', basePrice: 180, cost: 100, category: 'Controles' },
      { description: 'Mano de obra (hora)', unit: 'hour', basePrice: 55, cost: 32, category: 'Varios' },
    ],
  },

  {
    id: 'aerotermia',
    name: 'Aerotermia',
    description: 'Sistemas de aerotermia y bomba de calor',
    tariffs: [
      { description: 'Bomba de calor aire-aire', unit: 'unit', basePrice: 2500, cost: 1500, category: 'Equipos' },
      { description: 'Bomba de calor aire-agua', unit: 'unit', basePrice: 3500, cost: 2000, category: 'Equipos' },
      { description: 'Instalación de unidad interior', unit: 'unit', basePrice: 600, cost: 350, category: 'Instalación' },
      { description: 'Instalación de unidad exterior', unit: 'unit', basePrice: 500, cost: 300, category: 'Instalación' },
      { description: 'Conducto de refrigeración (ml)', unit: 'ml', basePrice: 50, cost: 30, category: 'Conducciones' },
      { description: 'Tubería de agua caliente (ml)', unit: 'ml', basePrice: 45, cost: 28, category: 'Conducciones' },
      { description: 'Depósito de acumulación', unit: 'unit', basePrice: 800, cost: 480, category: 'Accesorios' },
      { description: 'Mano de obra (hora)', unit: 'hour', basePrice: 65, cost: 38, category: 'Varios' },
    ],
  },

  {
    id: 'energia_solar',
    name: 'Energía solar',
    description: 'Sistemas de energía solar fotovoltaica y térmica',
    tariffs: [
      { description: 'Panel solar fotovoltaico', unit: 'unit', basePrice: 350, cost: 200, category: 'Paneles FV' },
      { description: 'Panel solar térmico', unit: 'unit', basePrice: 400, cost: 240, category: 'Paneles térmicos' },
      { description: 'Inversor fotovoltaico', unit: 'unit', basePrice: 600, cost: 350, category: 'Inversores' },
      { description: 'Batería de almacenamiento', unit: 'unit', basePrice: 1200, cost: 700, category: 'Almacenamiento' },
      { description: 'Estructura de montaje (m2)', unit: 'm2', basePrice: 80, cost: 48, category: 'Estructuras' },
      { description: 'Instalación de paneles (m2)', unit: 'm2', basePrice: 120, cost: 70, category: 'Instalación' },
      { description: 'Cableado y conexión', unit: 'unit', basePrice: 250, cost: 150, category: 'Instalación' },
      { description: 'Mano de obra (hora)', unit: 'hour', basePrice: 70, cost: 40, category: 'Varios' },
    ],
  },

  {
    id: 'carpinteria_madera',
    name: 'Carpintería de madera',
    description: 'Trabajos de carpintería en madera',
    tariffs: [
      { description: 'Puerta interior estándar', unit: 'unit', basePrice: 120, cost: 65, category: 'Puertas' },
      { description: 'Puerta corredera', unit: 'unit', basePrice: 180, cost: 100, category: 'Puertas' },
      { description: 'Puerta exterior', unit: 'unit', basePrice: 220, cost: 130, category: 'Puertas' },
      { description: 'Marco y cerco', unit: 'unit', basePrice: 80, cost: 45, category: 'Marcos' },
      { description: 'Estantería a medida (ml)', unit: 'ml', basePrice: 150, cost: 85, category: 'Muebles' },
      { description: 'Armario empotrado (m2)', unit: 'm2', basePrice: 250, cost: 140, category: 'Muebles' },
      { description: 'Moldura y remate (ml)', unit: 'ml', basePrice: 25, cost: 14, category: 'Acabados' },
      { description: 'Reparación/ajuste de puerta', unit: 'unit', basePrice: 65, cost: 38, category: 'Reparaciones' },
      { description: 'Mano de obra (hora)', unit: 'hour', basePrice: 50, cost: 28, category: 'Varios' },
    ],
  },

  {
    id: 'carpinteria_aluminio',
    name: 'Carpintería de aluminio y PVC',
    description: 'Trabajos de carpintería en aluminio y PVC',
    tariffs: [
      { description: 'Ventana de aluminio (m2)', unit: 'm2', basePrice: 180, cost: 105, category: 'Ventanas' },
      { description: 'Ventana de PVC (m2)', unit: 'm2', basePrice: 150, cost: 88, category: 'Ventanas' },
      { description: 'Puerta de aluminio', unit: 'unit', basePrice: 220, cost: 130, category: 'Puertas' },
      { description: 'Puerta de PVC', unit: 'unit', basePrice: 180, cost: 105, category: 'Puertas' },
      { description: 'Puerta corredera de aluminio', unit: 'unit', basePrice: 320, cost: 180, category: 'Puertas' },
      { description: 'Persiana de aluminio', unit: 'm2', basePrice: 120, cost: 70, category: 'Persianas' },
      { description: 'Mosquitera', unit: 'unit', basePrice: 75, cost: 42, category: 'Accesorios' },
      { description: 'Sellado y aislamiento', unit: 'ml', basePrice: 20, cost: 12, category: 'Acabados' },
      { description: 'Mano de obra (hora)', unit: 'hour', basePrice: 50, cost: 28, category: 'Varios' },
    ],
  },

  {
    id: 'cerrajeria',
    name: 'Cerrajería',
    description: 'Servicios de cerrajería y cerraduras',
    tariffs: [
      { description: 'Cerradura de seguridad', unit: 'unit', basePrice: 95, cost: 55, category: 'Cerraduras' },
      { description: 'Cerradura blindada', unit: 'unit', basePrice: 180, cost: 105, category: 'Cerraduras' },
      { description: 'Cilindro de seguridad', unit: 'unit', basePrice: 65, cost: 38, category: 'Cerraduras' },
      { description: 'Manilla de puerta', unit: 'unit', basePrice: 45, cost: 25, category: 'Herrajes' },
      { description: 'Bisagra de puerta', unit: 'unit', basePrice: 35, cost: 20, category: 'Herrajes' },
      { description: 'Pulsador/tirador de puerta', unit: 'unit', basePrice: 55, cost: 32, category: 'Herrajes' },
      { description: 'Cadena de seguridad', unit: 'unit', basePrice: 35, cost: 20, category: 'Accesorios' },
      { description: 'Mirilla óptica', unit: 'unit', basePrice: 45, cost: 25, category: 'Accesorios' },
      { description: 'Instalación de cerradura', unit: 'unit', basePrice: 60, cost: 35, category: 'Instalación' },
      { description: 'Mano de obra (hora)', unit: 'hour', basePrice: 45, cost: 25, category: 'Varios' },
    ],
  },

  {
    id: 'pladur',
    name: 'Pladur',
    description: 'Sistemas de pladur y tabiquería ligera',
    tariffs: [
      { description: 'Tabique de pladur (15cm)', unit: 'm2', basePrice: 45, cost: 28, category: 'Tabiques' },
      { description: 'Tabique de pladur (10cm)', unit: 'm2', basePrice: 40, cost: 25, category: 'Tabiques' },
      { description: 'Tabique con aislamiento acústico', unit: 'm2', basePrice: 55, cost: 32, category: 'Tabiques' },
      { description: 'Trasdosado de pladur', unit: 'm2', basePrice: 35, cost: 20, category: 'Trasdosados' },
      { description: 'Falso techo de pladur', unit: 'm2', basePrice: 38, cost: 22, category: 'Techos' },
      { description: 'Falso techo desmontable', unit: 'm2', basePrice: 30, cost: 18, category: 'Techos' },
      { description: 'Foseado para iluminación indirecta', unit: 'ml', basePrice: 45, cost: 28, category: 'Techos' },
      { description: 'Acabado y pintura (m2)', unit: 'm2', basePrice: 18, cost: 10, category: 'Acabados' },
      { description: 'Mano de obra (hora)', unit: 'hour', basePrice: 45, cost: 25, category: 'Varios' },
    ],
  },

  {
    id: 'solados_alicatados',
    name: 'Solados y alicatados',
    description: 'Colocación de solados y alicatados',
    tariffs: [
      { description: 'Colocación de suelo cerámico', unit: 'm2', basePrice: 35, cost: 20, category: 'Solados' },
      { description: 'Colocación de gres porcelánico', unit: 'm2', basePrice: 40, cost: 24, category: 'Solados' },
      { description: 'Colocación de granito', unit: 'm2', basePrice: 65, cost: 40, category: 'Solados' },
      { description: 'Colocación de mármol', unit: 'm2', basePrice: 75, cost: 45, category: 'Solados' },
      { description: 'Suelo de microcemento', unit: 'm2', basePrice: 75, cost: 45, category: 'Solados especiales' },
      { description: 'Suelo vinílico', unit: 'm2', basePrice: 25, cost: 14, category: 'Solados especiales' },
      { description: 'Rodapié cerámico', unit: 'ml', basePrice: 10, cost: 5, category: 'Acabados' },
      { description: 'Alicatado de paredes', unit: 'm2', basePrice: 30, cost: 17, category: 'Alicatados' },
      { description: 'Alicatado de gres porcelánico', unit: 'm2', basePrice: 38, cost: 22, category: 'Alicatados' },
      { description: 'Preparación de suelo', unit: 'm2', basePrice: 15, cost: 9, category: 'Preparación' },
      { description: 'Mano de obra (hora)', unit: 'hour', basePrice: 50, cost: 28, category: 'Varios' },
    ],
  },

  {
    id: 'tarima_parquet',
    name: 'Tarima y parquet',
    description: 'Colocación de tarima y parquet',
    tariffs: [
      { description: 'Instalación de tarima flotante', unit: 'm2', basePrice: 28, cost: 16, category: 'Tarima flotante' },
      { description: 'Instalación de tarima maciza', unit: 'm2', basePrice: 45, cost: 28, category: 'Tarima maciza' },
      { description: 'Instalación de parquet', unit: 'm2', basePrice: 55, cost: 35, category: 'Parquet' },
      { description: 'Parquet de alta gama', unit: 'm2', basePrice: 85, cost: 50, category: 'Parquet' },
      { description: 'Lijado de parquet existente', unit: 'm2', basePrice: 25, cost: 14, category: 'Reparación' },
      { description: 'Barnizado de parquet', unit: 'm2', basePrice: 20, cost: 12, category: 'Tratamientos' },
      { description: 'Tratamiento de protección', unit: 'm2', basePrice: 15, cost: 9, category: 'Tratamientos' },
      { description: 'Subbases y preparación', unit: 'm2', basePrice: 12, cost: 7, category: 'Preparación' },
      { description: 'Mano de obra (hora)', unit: 'hour', basePrice: 50, cost: 28, category: 'Varios' },
    ],
  },

  {
    id: 'jardineria',
    name: 'Jardinería',
    description: 'Servicios de jardinería y mantenimiento',
    tariffs: [
      { description: 'Plantación de árbol', unit: 'unit', basePrice: 85, cost: 50, category: 'Plantaciones' },
      { description: 'Plantación de arbusto', unit: 'unit', basePrice: 35, cost: 20, category: 'Plantaciones' },
      { description: 'Plantación de flores (m2)', unit: 'm2', basePrice: 25, cost: 14, category: 'Plantaciones' },
      { description: 'Poda de árbol', unit: 'unit', basePrice: 95, cost: 55, category: 'Poda' },
      { description: 'Poda de seto (ml)', unit: 'ml', basePrice: 15, cost: 9, category: 'Poda' },
      { description: 'Tala de árbol', unit: 'unit', basePrice: 180, cost: 100, category: 'Talas' },
      { description: 'Replanteo de jardín', unit: 'm2', basePrice: 45, cost: 25, category: 'Diseño' },
      { description: 'Paisajismo (proyecto)', unit: 'm2', basePrice: 80, cost: 45, category: 'Diseño' },
      { description: 'Mano de obra (hora)', unit: 'hour', basePrice: 40, cost: 23, category: 'Varios' },
    ],
  },

  {
    id: 'cesped_artificial',
    name: 'Césped artificial',
    description: 'Instalación de césped artificial',
    tariffs: [
      { description: 'Césped artificial estándar', unit: 'm2', basePrice: 35, cost: 20, category: 'Material' },
      { description: 'Césped artificial de lujo', unit: 'm2', basePrice: 55, cost: 32, category: 'Material' },
      { description: 'Instalación de césped artificial', unit: 'm2', basePrice: 22, cost: 13, category: 'Instalación' },
      { description: 'Preparación del terreno', unit: 'm2', basePrice: 15, cost: 9, category: 'Preparación' },
      { description: 'Tratamiento antiséptico', unit: 'm2', basePrice: 8, cost: 4, category: 'Tratamientos' },
      { description: 'Perforación de drenaje', unit: 'm2', basePrice: 12, cost: 7, category: 'Drenaje' },
      { description: 'Mano de obra (hora)', unit: 'hour', basePrice: 40, cost: 23, category: 'Varios' },
    ],
  },

  {
    id: 'piscinas',
    name: 'Piscinas',
    description: 'Construcción y mantenimiento de piscinas',
    tariffs: [
      { description: 'Excavación de piscina', unit: 'm3', basePrice: 45, cost: 28, category: 'Obra' },
      { description: 'Revestimiento de fibra', unit: 'm2', basePrice: 85, cost: 50, category: 'Revestimientos' },
      { description: 'Revestimiento de azulejo', unit: 'm2', basePrice: 65, cost: 38, category: 'Revestimientos' },
      { description: 'Sistema de filtración completo', unit: 'unit', basePrice: 1200, cost: 700, category: 'Filtración' },
      { description: 'Bomba de piscina', unit: 'unit', basePrice: 450, cost: 260, category: 'Bombeo' },
      { description: 'Depurador de cloro', unit: 'unit', basePrice: 350, cost: 200, category: 'Tratamiento' },
      { description: 'Escalerilla de piscina', unit: 'unit', basePrice: 180, cost: 100, category: 'Accesorios' },
      { description: 'Mano de obra (hora)', unit: 'hour', basePrice: 60, cost: 35, category: 'Varios' },
    ],
  },

  {
    id: 'limpieza_profesional',
    name: 'Limpieza profesional',
    description: 'Servicios de limpieza profesional',
    tariffs: [
      { description: 'Limpieza de oficina', unit: 'm2', basePrice: 8, cost: 4, category: 'Limpieza regular' },
      { description: 'Limpieza de comercio', unit: 'm2', basePrice: 10, cost: 5, category: 'Limpieza regular' },
      { description: 'Limpieza de hogar', unit: 'm2', basePrice: 9, cost: 4, category: 'Limpieza regular' },
      { description: 'Limpieza profunda', unit: 'm2', basePrice: 15, cost: 8, category: 'Limpieza profunda' },
      { description: 'Limpieza de cristales', unit: 'm2', basePrice: 12, cost: 6, category: 'Cristales' },
      { description: 'Desinfección y sanitizado', unit: 'm2', basePrice: 18, cost: 10, category: 'Desinfección' },
      { description: 'Tratamiento de plagas', unit: 'unit', basePrice: 250, cost: 150, category: 'Control de plagas' },
      { description: 'Mano de obra (hora)', unit: 'hour', basePrice: 30, cost: 16, category: 'Varios' },
    ],
  },

  {
    id: 'limpieza_obra',
    name: 'Limpieza fin de obra',
    description: 'Limpieza y acondicionamiento post-obra',
    tariffs: [
      { description: 'Limpieza post-obra estándar', unit: 'm2', basePrice: 18, cost: 10, category: 'Limpieza base' },
      { description: 'Limpieza post-obra profunda', unit: 'm2', basePrice: 25, cost: 14, category: 'Limpieza profunda' },
      { description: 'Limpieza de vidrios post-obra', unit: 'm2', basePrice: 20, cost: 12, category: 'Vidrios' },
      { description: 'Limpieza de fachadas', unit: 'm2', basePrice: 22, cost: 13, category: 'Fachadas' },
      { description: 'Pulido de suelos', unit: 'm2', basePrice: 15, cost: 8, category: 'Suelos' },
      { description: 'Retirada de restos y escombros', unit: 'unit', basePrice: 280, cost: 160, category: 'Gestión de residuos' },
      { description: 'Desinfección y sanitizado', unit: 'm2', basePrice: 18, cost: 10, category: 'Desinfección' },
      { description: 'Mano de obra (hora)', unit: 'hour', basePrice: 35, cost: 20, category: 'Varios' },
    ],
  },

  {
    id: 'mudanzas',
    name: 'Mudanzas y porte',
    description: 'Servicios de mudanza y transporte',
    tariffs: [
      { description: 'Embalaje de mueble', unit: 'unit', basePrice: 35, cost: 20, category: 'Embalaje' },
      { description: 'Embalaje de frágil', unit: 'unit', basePrice: 25, cost: 14, category: 'Embalaje' },
      { description: 'Embalaje de electrodoméstico', unit: 'unit', basePrice: 40, cost: 23, category: 'Embalaje' },
      { description: 'Transporte por km', unit: 'ml', basePrice: 3, cost: 1.5, category: 'Transporte' },
      { description: 'Carga y descarga', unit: 'hour', basePrice: 45, cost: 25, category: 'Servicios' },
      { description: 'Montaje de muebles', unit: 'unit', basePrice: 85, cost: 50, category: 'Servicios' },
      { description: 'Desmontaje de muebles', unit: 'unit', basePrice: 75, cost: 42, category: 'Servicios' },
      { description: 'Mano de obra (hora)', unit: 'hour', basePrice: 40, cost: 23, category: 'Varios' },
    ],
  },
];
