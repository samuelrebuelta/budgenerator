import type { Tariff } from '@/shared/types';

export const RENOVATION_CATEGORIES = [
  'Demolición',
  'Gestión de residuos',
  'Albañilería',
  'Tabiquería',
  'Suelos',
  'Alicatado',
  'Revestimientos',
  'Pintura',
  'Techos',
  'Tejado',
  'Electricidad',
  'Fontanería',
  'Sanitarios',
  'Grifería',
  'Calefacción',
  'Refrigeración',
  'Aerotermia',
  'Carpintería',
  'Ventanas y persianas',
  'Cerrajería',
  'Cristalería',
  'Muebles de cocina',
  'Muebles de baño',
  'Impermeabilización',
  'Aislamientos',
  'Domótica',
  'Mano de obra',
  'Varios',
] as const;

export const DEFAULT_TARIFFS: Tariff[] = [
  // Demolición
  { id: 't1', description: 'Demolición y retirada de escombros', unit: 'm2', basePrice: 20, cost: 12, category: 'Demolición' },
  { id: 't2', description: 'Demolición de tabique', unit: 'm2', basePrice: 18, cost: 10, category: 'Demolición' },
  { id: 't3', description: 'Levantado de solado existente', unit: 'm2', basePrice: 15, cost: 9, category: 'Demolición' },
  { id: 't4', description: 'Levantado de alicatado existente', unit: 'm2', basePrice: 14, cost: 8, category: 'Demolición' },
  { id: 't5', description: 'Desmontaje de sanitarios', unit: 'unit', basePrice: 45, cost: 25, category: 'Demolición' },
  { id: 't6', description: 'Desmontaje de muebles de cocina', unit: 'ml', basePrice: 30, cost: 18, category: 'Demolición' },
  { id: 't7', description: 'Contenedor de escombros (6m³)', unit: 'unit', basePrice: 280, cost: 180, category: 'Gestión de residuos' },

  // Albañilería
  { id: 't10', description: 'Enlucido de paredes', unit: 'm2', basePrice: 25, cost: 14, category: 'Albañilería' },
  { id: 't11', description: 'Enfoscado de cemento', unit: 'm2', basePrice: 20, cost: 12, category: 'Albañilería' },
  { id: 't12', description: 'Guarnecido y enlucido de yeso', unit: 'm2', basePrice: 18, cost: 10, category: 'Albañilería' },
  { id: 't13', description: 'Recrecido de suelo (mortero)', unit: 'm2', basePrice: 16, cost: 9, category: 'Albañilería' },
  { id: 't14', description: 'Formación de rozas', unit: 'ml', basePrice: 8, cost: 4, category: 'Albañilería' },
  { id: 't15', description: 'Apertura de hueco en muro', unit: 'unit', basePrice: 350, cost: 200, category: 'Albañilería' },

  // Tabiquería
  { id: 't20', description: 'Tabique de pladur (15cm)', unit: 'm2', basePrice: 45, cost: 28, category: 'Tabiquería' },
  { id: 't21', description: 'Tabique de ladrillo hueco sencillo', unit: 'm2', basePrice: 30, cost: 18, category: 'Tabiquería' },
  { id: 't22', description: 'Tabique de ladrillo hueco doble', unit: 'm2', basePrice: 38, cost: 22, category: 'Tabiquería' },
  { id: 't23', description: 'Trasdosado de pladur', unit: 'm2', basePrice: 35, cost: 20, category: 'Tabiquería' },

  // Suelos
  { id: 't30', description: 'Colocación de suelo cerámico', unit: 'm2', basePrice: 35, cost: 20, category: 'Suelos' },
  { id: 't31', description: 'Colocación de gres porcelánico', unit: 'm2', basePrice: 40, cost: 24, category: 'Suelos' },
  { id: 't32', description: 'Instalación de tarima flotante', unit: 'm2', basePrice: 28, cost: 16, category: 'Suelos' },
  { id: 't33', description: 'Instalación de parquet', unit: 'm2', basePrice: 55, cost: 35, category: 'Suelos' },
  { id: 't34', description: 'Suelo de microcemento', unit: 'm2', basePrice: 75, cost: 45, category: 'Suelos' },
  { id: 't35', description: 'Suelo vinílico', unit: 'm2', basePrice: 25, cost: 14, category: 'Suelos' },
  { id: 't36', description: 'Solera de hormigón (10cm)', unit: 'm2', basePrice: 30, cost: 18, category: 'Suelos' },
  { id: 't37', description: 'Rodapié cerámico', unit: 'ml', basePrice: 10, cost: 5, category: 'Suelos' },

  // Alicatado / Revestimientos
  { id: 't40', description: 'Alicatado de paredes', unit: 'm2', basePrice: 30, cost: 17, category: 'Alicatado' },
  { id: 't41', description: 'Alicatado de gres porcelánico', unit: 'm2', basePrice: 38, cost: 22, category: 'Alicatado' },
  { id: 't42', description: 'Revestimiento de microcemento', unit: 'm2', basePrice: 70, cost: 42, category: 'Revestimientos' },
  { id: 't43', description: 'Revestimiento de piedra natural', unit: 'm2', basePrice: 85, cost: 55, category: 'Revestimientos' },
  { id: 't44', description: 'Papel pintado', unit: 'm2', basePrice: 22, cost: 12, category: 'Revestimientos' },

  // Pintura
  { id: 't50', description: 'Pintura interior (2 manos)', unit: 'm2', basePrice: 15, cost: 8, category: 'Pintura' },
  { id: 't51', description: 'Pintura de techos', unit: 'm2', basePrice: 14, cost: 7, category: 'Pintura' },
  { id: 't52', description: 'Pintura exterior (fachada)', unit: 'm2', basePrice: 20, cost: 12, category: 'Pintura' },
  { id: 't53', description: 'Lacado de puertas', unit: 'unit', basePrice: 120, cost: 65, category: 'Pintura' },
  { id: 't54', description: 'Pintura epoxi (suelos)', unit: 'm2', basePrice: 25, cost: 14, category: 'Pintura' },

  // Techos
  { id: 't60', description: 'Instalación de falso techo de pladur', unit: 'm2', basePrice: 38, cost: 22, category: 'Techos' },
  { id: 't61', description: 'Falso techo desmontable', unit: 'm2', basePrice: 30, cost: 18, category: 'Techos' },
  { id: 't62', description: 'Foseado para iluminación indirecta', unit: 'ml', basePrice: 45, cost: 28, category: 'Techos' },

  // Tejado / Cubierta
  { id: 't70', description: 'Reparación de cubierta de teja', unit: 'm2', basePrice: 55, cost: 35, category: 'Tejado' },
  { id: 't71', description: 'Impermeabilización de cubierta', unit: 'm2', basePrice: 40, cost: 25, category: 'Tejado' },
  { id: 't72', description: 'Sustitución de canalón', unit: 'ml', basePrice: 25, cost: 14, category: 'Tejado' },
  { id: 't73', description: 'Aislamiento de cubierta', unit: 'm2', basePrice: 35, cost: 20, category: 'Tejado' },

  // Electricidad
  { id: 't80', description: 'Punto de luz sencillo', unit: 'unit', basePrice: 85, cost: 50, category: 'Electricidad' },
  { id: 't81', description: 'Punto de luz conmutado', unit: 'unit', basePrice: 110, cost: 65, category: 'Electricidad' },
  { id: 't82', description: 'Punto de enchufe', unit: 'unit', basePrice: 75, cost: 42, category: 'Electricidad' },
  { id: 't83', description: 'Cuadro eléctrico completo', unit: 'unit', basePrice: 650, cost: 380, category: 'Electricidad' },
  { id: 't84', description: 'Línea eléctrica independiente', unit: 'unit', basePrice: 180, cost: 100, category: 'Electricidad' },
  { id: 't85', description: 'Toma de TV/datos', unit: 'unit', basePrice: 70, cost: 40, category: 'Electricidad' },
  { id: 't86', description: 'Cableado estructurado (red)', unit: 'unit', basePrice: 95, cost: 55, category: 'Electricidad' },
  { id: 't87', description: 'Mecanismos (interruptores/enchufes)', unit: 'unit', basePrice: 18, cost: 8, category: 'Electricidad' },
  { id: 't88', description: 'Boletín eléctrico', unit: 'unit', basePrice: 200, cost: 120, category: 'Electricidad' },

  // Fontanería
  { id: 't90', description: 'Punto de agua fría/caliente', unit: 'unit', basePrice: 120, cost: 70, category: 'Fontanería' },
  { id: 't91', description: 'Instalación de desagüe', unit: 'unit', basePrice: 90, cost: 50, category: 'Fontanería' },
  { id: 't92', description: 'Tubería de cobre', unit: 'ml', basePrice: 35, cost: 20, category: 'Fontanería' },
  { id: 't93', description: 'Tubería multicapa', unit: 'ml', basePrice: 28, cost: 15, category: 'Fontanería' },
  { id: 't94', description: 'Bajante de PVC', unit: 'ml', basePrice: 40, cost: 22, category: 'Fontanería' },
  { id: 't95', description: 'Llave de corte', unit: 'unit', basePrice: 35, cost: 18, category: 'Fontanería' },

  // Sanitarios
  { id: 't100', description: 'Instalación de inodoro', unit: 'unit', basePrice: 180, cost: 90, category: 'Sanitarios' },
  { id: 't101', description: 'Instalación de lavabo', unit: 'unit', basePrice: 150, cost: 75, category: 'Sanitarios' },
  { id: 't102', description: 'Instalación de bidé', unit: 'unit', basePrice: 160, cost: 80, category: 'Sanitarios' },
  { id: 't103', description: 'Instalación de plato de ducha', unit: 'unit', basePrice: 250, cost: 140, category: 'Sanitarios' },
  { id: 't104', description: 'Instalación de bañera', unit: 'unit', basePrice: 320, cost: 180, category: 'Sanitarios' },
  { id: 't105', description: 'Mampara de ducha', unit: 'unit', basePrice: 350, cost: 200, category: 'Sanitarios' },

  // Grifería
  { id: 't110', description: 'Grifo monomando lavabo', unit: 'unit', basePrice: 85, cost: 45, category: 'Grifería' },
  { id: 't111', description: 'Grifo monomando ducha', unit: 'unit', basePrice: 120, cost: 65, category: 'Grifería' },
  { id: 't112', description: 'Grifo termostático ducha', unit: 'unit', basePrice: 180, cost: 100, category: 'Grifería' },
  { id: 't113', description: 'Grifo de cocina', unit: 'unit', basePrice: 95, cost: 50, category: 'Grifería' },

  // Calefacción
  { id: 't120', description: 'Radiador de aluminio (elemento)', unit: 'unit', basePrice: 35, cost: 18, category: 'Calefacción' },
  { id: 't121', description: 'Instalación de radiador completo', unit: 'unit', basePrice: 180, cost: 100, category: 'Calefacción' },
  { id: 't122', description: 'Suelo radiante', unit: 'm2', basePrice: 65, cost: 40, category: 'Calefacción' },
  { id: 't123', description: 'Caldera de gas condensación', unit: 'unit', basePrice: 2800, cost: 1800, category: 'Calefacción' },
  { id: 't124', description: 'Termo eléctrico', unit: 'unit', basePrice: 450, cost: 250, category: 'Calefacción' },
  { id: 't125', description: 'Tubería de calefacción', unit: 'ml', basePrice: 25, cost: 14, category: 'Calefacción' },

  // Refrigeración / Aire acondicionado
  { id: 't130', description: 'Split de aire acondicionado', unit: 'unit', basePrice: 1200, cost: 750, category: 'Refrigeración' },
  { id: 't131', description: 'Conductos de aire acondicionado', unit: 'ml', basePrice: 55, cost: 32, category: 'Refrigeración' },
  { id: 't132', description: 'Rejilla de impulsión/retorno', unit: 'unit', basePrice: 45, cost: 22, category: 'Refrigeración' },
  { id: 't133', description: 'Instalación de preinstalación A/A', unit: 'unit', basePrice: 350, cost: 200, category: 'Refrigeración' },

  // Aerotermia
  { id: 't140', description: 'Bomba de calor aerotermia (monobloc)', unit: 'unit', basePrice: 5500, cost: 3500, category: 'Aerotermia' },
  { id: 't141', description: 'Bomba de calor aerotermia (bibloc)', unit: 'unit', basePrice: 6500, cost: 4200, category: 'Aerotermia' },
  { id: 't142', description: 'Depósito de ACS para aerotermia', unit: 'unit', basePrice: 1200, cost: 750, category: 'Aerotermia' },
  { id: 't143', description: 'Instalación completa aerotermia', unit: 'unit', basePrice: 8500, cost: 5500, category: 'Aerotermia' },

  // Carpintería
  { id: 't150', description: 'Puerta de paso ciega lacada', unit: 'unit', basePrice: 280, cost: 160, category: 'Carpintería' },
  { id: 't151', description: 'Puerta de paso vidriera', unit: 'unit', basePrice: 350, cost: 200, category: 'Carpintería' },
  { id: 't152', description: 'Puerta corredera empotrada', unit: 'unit', basePrice: 550, cost: 320, category: 'Carpintería' },
  { id: 't153', description: 'Armario empotrado (frente)', unit: 'ml', basePrice: 450, cost: 280, category: 'Carpintería' },
  { id: 't154', description: 'Interior de armario', unit: 'ml', basePrice: 250, cost: 150, category: 'Carpintería' },

  // Ventanas y persianas
  { id: 't160', description: 'Ventana de PVC (doble cristal)', unit: 'unit', basePrice: 450, cost: 280, category: 'Ventanas y persianas' },
  { id: 't161', description: 'Ventana de aluminio RPT', unit: 'unit', basePrice: 520, cost: 320, category: 'Ventanas y persianas' },
  { id: 't162', description: 'Persiana de aluminio', unit: 'unit', basePrice: 220, cost: 130, category: 'Ventanas y persianas' },
  { id: 't163', description: 'Motor de persiana', unit: 'unit', basePrice: 180, cost: 100, category: 'Ventanas y persianas' },

  // Cerrajería
  { id: 't170', description: 'Puerta de entrada blindada', unit: 'unit', basePrice: 1200, cost: 750, category: 'Cerrajería' },
  { id: 't171', description: 'Puerta de entrada acorazada', unit: 'unit', basePrice: 2200, cost: 1400, category: 'Cerrajería' },
  { id: 't172', description: 'Reja de seguridad', unit: 'm2', basePrice: 120, cost: 70, category: 'Cerrajería' },

  // Cristalería
  { id: 't180', description: 'Espejo a medida', unit: 'm2', basePrice: 90, cost: 50, category: 'Cristalería' },
  { id: 't181', description: 'Cerramiento de cristal', unit: 'm2', basePrice: 280, cost: 170, category: 'Cristalería' },

  // Muebles de cocina
  { id: 't190', description: 'Mueble bajo de cocina', unit: 'ml', basePrice: 350, cost: 210, category: 'Muebles de cocina' },
  { id: 't191', description: 'Mueble alto de cocina', unit: 'ml', basePrice: 280, cost: 165, category: 'Muebles de cocina' },
  { id: 't192', description: 'Encimera de granito', unit: 'ml', basePrice: 200, cost: 120, category: 'Muebles de cocina' },
  { id: 't193', description: 'Encimera de cuarzo compacto', unit: 'ml', basePrice: 280, cost: 170, category: 'Muebles de cocina' },
  { id: 't194', description: 'Instalación de fregadero', unit: 'unit', basePrice: 120, cost: 60, category: 'Muebles de cocina' },

  // Muebles de baño
  { id: 't200', description: 'Mueble de baño con lavabo', unit: 'unit', basePrice: 450, cost: 260, category: 'Muebles de baño' },
  { id: 't201', description: 'Espejo de baño con luz', unit: 'unit', basePrice: 180, cost: 95, category: 'Muebles de baño' },
  { id: 't202', description: 'Columna auxiliar de baño', unit: 'unit', basePrice: 220, cost: 130, category: 'Muebles de baño' },

  // Impermeabilización
  { id: 't210', description: 'Impermeabilización con tela asfáltica', unit: 'm2', basePrice: 30, cost: 18, category: 'Impermeabilización' },
  { id: 't211', description: 'Impermeabilización líquida', unit: 'm2', basePrice: 25, cost: 14, category: 'Impermeabilización' },
  { id: 't212', description: 'Impermeabilización de ducha/bañera', unit: 'unit', basePrice: 180, cost: 100, category: 'Impermeabilización' },

  // Aislamientos
  { id: 't220', description: 'Aislamiento térmico (lana mineral)', unit: 'm2', basePrice: 22, cost: 12, category: 'Aislamientos' },
  { id: 't221', description: 'Aislamiento con poliestireno extruido', unit: 'm2', basePrice: 25, cost: 14, category: 'Aislamientos' },
  { id: 't222', description: 'Aislamiento acústico', unit: 'm2', basePrice: 30, cost: 18, category: 'Aislamientos' },
  { id: 't223', description: 'Insuflado de celulosa', unit: 'm2', basePrice: 20, cost: 11, category: 'Aislamientos' },

  // Domótica
  { id: 't230', description: 'Interruptor inteligente', unit: 'unit', basePrice: 65, cost: 35, category: 'Domótica' },
  { id: 't231', description: 'Termostato inteligente', unit: 'unit', basePrice: 250, cost: 150, category: 'Domótica' },
  { id: 't232', description: 'Cerradura electrónica', unit: 'unit', basePrice: 350, cost: 200, category: 'Domótica' },
  { id: 't233', description: 'Videoportero IP', unit: 'unit', basePrice: 450, cost: 260, category: 'Domótica' },

  // Mano de obra
  { id: 't240', description: 'Mano de obra oficial', unit: 'hour', basePrice: 35, cost: 22, category: 'Mano de obra' },
  { id: 't241', description: 'Mano de obra peón', unit: 'hour', basePrice: 25, cost: 16, category: 'Mano de obra' },
  { id: 't242', description: 'Horas de fontanero', unit: 'hour', basePrice: 40, cost: 25, category: 'Mano de obra' },
  { id: 't243', description: 'Horas de electricista', unit: 'hour', basePrice: 40, cost: 25, category: 'Mano de obra' },

  // Varios
  { id: 't250', description: 'Limpieza final de obra', unit: 'm2', basePrice: 5, cost: 3, category: 'Varios' },
  { id: 't251', description: 'Protección de obra (plásticos/cartón)', unit: 'm2', basePrice: 3, cost: 1.5, category: 'Varios' },
  { id: 't252', description: 'Pequeño material', unit: 'unit', basePrice: 150, cost: 80, category: 'Varios' },
];

export function getTariffById(tariffs: Tariff[], id: string): Tariff | undefined {
  return tariffs.find((t) => t.id === id);
}

export function getTariffsByCategory(tariffs: Tariff[], category: string): Tariff[] {
  return tariffs.filter((t) => t.category === category);
}

export function getCategories(tariffs: Tariff[]): string[] {
  return [...new Set(tariffs.map((t) => t.category))];
}
