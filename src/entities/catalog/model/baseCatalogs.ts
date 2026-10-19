import type { Unit } from '@/shared/types';

export interface BaseCatalog {
  id: string;
  name: string;
  description: string;
  tariffs: { description: string; unit: Unit; basePrice: number; cost: number; category: string }[];
}

interface CatalogPartSeed {
  name: string;
  concepts: [description: string, unit: Unit][];
}

const renovationParts: CatalogPartSeed[] = [
  {
    name: 'Accesibilidad',
    concepts: [
      ['Rampa de acceso', 'm2'],
      ['Pasamanos', 'ml'],
      ['Barra de apoyo', 'unit'],
      ['Adaptación de ducha', 'unit'],
      ['Puerta de paso accesible', 'unit'],
      ['Plataforma salvaescaleras', 'unit'],
      ['Pavimento antideslizante', 'm2'],
    ],
  },
  {
    name: 'Aislamiento',
    concepts: [
      ['Aislamiento térmico interior', 'm2'],
      ['Aislamiento acústico entre viviendas', 'm2'],
      ['Aislamiento bajo pavimento', 'm2'],
      ['Aislamiento de cubierta', 'm2'],
      ['Tratamiento de puente térmico', 'ml'],
      ['Sellado de paso de instalaciones', 'unit'],
      ['Protección pasiva contra incendios', 'unit'],
    ],
  },
  {
    name: 'Albañilería',
    concepts: [
      ['Tabique de ladrillo', 'm2'],
      ['Tabique de bloque', 'm2'],
      ['Cerramiento de fábrica', 'm2'],
      ['Recibido de premarco', 'unit'],
      ['Apertura de rozas', 'ml'],
      ['Tapado de rozas', 'ml'],
      ['Recrecido y nivelación', 'm2'],
      ['Formación de pendientes', 'm2'],
      ['Reparación de muro', 'm2'],
    ],
  },
  {
    name: 'Carpintería',
    concepts: [
      ['Puerta interior de madera', 'unit'],
      ['Cerco y premarco de madera', 'unit'],
      ['Puerta corredera interior', 'unit'],
      ['Armario empotrado', 'unit'],
      ['Interior de armario', 'm2'],
      ['Rodapié de madera', 'ml'],
      ['Friso de madera', 'm2'],
      ['Escalera de madera', 'unit'],
      ['Sustitución de herrajes', 'unit'],
      ['Lijado y barnizado de madera', 'm2'],
    ],
  },
  {
    name: 'Cerrajería',
    concepts: [
      ['Barandilla metálica', 'ml'],
      ['Reja metálica', 'm2'],
      ['Puerta metálica', 'unit'],
      ['Portón metálico', 'unit'],
      ['Estructura metálica ligera', 'unit'],
      ['Cerradura de seguridad', 'unit'],
      ['Reparación de elemento metálico', 'hour'],
    ],
  },
  {
    name: 'Cimentación',
    concepts: [
      ['Excavación manual', 'm3'],
      ['Excavación mecánica', 'm3'],
      ['Zanja para instalaciones', 'ml'],
      ['Relleno de tierras', 'm3'],
      ['Compactación de terreno', 'm2'],
      ['Hormigón de limpieza', 'm2'],
      ['Zapata de cimentación', 'm3'],
      ['Drenaje perimetral', 'ml'],
      ['Retirada de tierras', 'm3'],
    ],
  },
  {
    name: 'Climatización',
    concepts: [
      ['Aire acondicionado split', 'unit'],
      ['Conducto de climatización', 'ml'],
      ['Rejilla de impulsión o retorno', 'unit'],
      ['Radiador', 'unit'],
      ['Suelo radiante', 'm2'],
      ['Bomba de calor', 'unit'],
      ['Ventilación mecánica', 'unit'],
      ['Extractor de baño', 'unit'],
      ['Extractor de cocina', 'unit'],
      ['Recuperador de calor', 'unit'],
      ['Mantenimiento de equipo', 'hour'],
    ],
  },
  {
    name: 'Cocinas',
    concepts: [
      ['Muebles bajos y altos de cocina', 'ml'],
      ['Encimera de cocina', 'ml'],
      ['Copete de encimera', 'ml'],
      ['Frente de cocina', 'm2'],
      ['Instalación de fregadero', 'unit'],
      ['Montaje de electrodoméstico', 'unit'],
      ['Mueble auxiliar a medida', 'unit'],
    ],
  },
  {
    name: 'Cubiertas',
    concepts: [
      ['Reparación de tejado de teja', 'm2'],
      ['Sustitución de teja', 'm2'],
      ['Cubierta plana', 'm2'],
      ['Aislamiento de cubierta', 'm2'],
      ['Remate y babero de cubierta', 'ml'],
      ['Lucernario', 'unit'],
      ['Canalón', 'ml'],
      ['Bajante pluvial', 'ml'],
      ['Sellado de chimenea', 'unit'],
    ],
  },
  {
    name: 'Demolición',
    concepts: [
      ['Desmontaje de cocina', 'unit'],
      ['Retirada de sanitarios y radiadores', 'unit'],
      ['Demolición de tabique', 'm2'],
      ['Demolición de falso techo', 'm2'],
      ['Levantado de pavimento', 'm2'],
      ['Retirada de alicatado', 'm2'],
      ['Apertura de hueco', 'unit'],
      ['Carga y retirada de escombros', 'm3'],
      ['Contenedor de escombros', 'unit'],
      ['Gestión de residuos especiales', 'unit'],
    ],
  },
  {
    name: 'Electricidad',
    concepts: [
      ['Cableado eléctrico', 'ml'],
      ['Canalización eléctrica', 'ml'],
      ['Canaleta eléctrica', 'ml'],
      ['Circuito eléctrico independiente', 'unit'],
      ['Cuadro eléctrico', 'unit'],
      ['Interruptor automático o diferencial', 'unit'],
      ['Toma de tierra', 'ml'],
      ['Enchufe simple', 'unit'],
      ['Enchufe doble', 'unit'],
      ['Enchufe especial de cocina', 'unit'],
      ['Interruptor', 'unit'],
      ['Conmutador', 'unit'],
      ['Cruzamiento', 'unit'],
      ['Punto de luz', 'unit'],
      ['Foco empotrado', 'unit'],
      ['Instalación de luminaria', 'unit'],
      ['Tira LED', 'ml'],
      ['Detector de presencia', 'unit'],
      ['Comprobación y certificado eléctrico', 'unit'],
    ],
  },
  {
    name: 'Energía solar',
    concepts: [
      ['Panel fotovoltaico', 'unit'],
      ['Inversor fotovoltaico', 'unit'],
      ['Batería de almacenamiento', 'unit'],
      ['Sistema solar térmico', 'unit'],
      ['Equipo de aerotermia', 'unit'],
      ['Monitorización energética', 'unit'],
      ['Punto de recarga de vehículo eléctrico', 'unit'],
      ['Integración con calefacción y agua caliente', 'unit'],
    ],
  },
  {
    name: 'Enlucidos',
    concepts: [
      ['Enfoscado de mortero', 'm2'],
      ['Guarnecido de yeso', 'm2'],
      ['Enlucido de yeso', 'm2'],
      ['Alisado de paredes', 'm2'],
      ['Regularización de paredes', 'm2'],
      ['Regularización de suelos', 'm2'],
      ['Mortero de reparación', 'm2'],
      ['Malla antifisuras', 'm2'],
      ['Preparación de superficie para pintar', 'm2'],
    ],
  },
  {
    name: 'Estructura',
    concepts: [
      ['Apertura estructural de hueco', 'unit'],
      ['Dintel de refuerzo', 'unit'],
      ['Refuerzo metálico', 'unit'],
      ['Pilar estructural', 'unit'],
      ['Viga estructural', 'ml'],
      ['Reparación de hormigón', 'm2'],
      ['Refuerzo de forjado', 'm2'],
      ['Losa de hormigón', 'm2'],
      ['Apeo estructural', 'unit'],
    ],
  },
  {
    name: 'Exteriores',
    concepts: [
      ['Pavimento exterior', 'm2'],
      ['Tarima exterior', 'm2'],
      ['Muro exterior', 'm2'],
      ['Vallado', 'ml'],
      ['Puerta de jardín', 'unit'],
      ['Adecuación de acceso común', 'unit'],
      ['Escalón exterior', 'unit'],
      ['Canaleta de drenaje exterior', 'ml'],
    ],
  },
  {
    name: 'Fachadas',
    concepts: [
      ['Reparación de enfoscado de fachada', 'm2'],
      ['Revestimiento de fachada', 'm2'],
      ['Aislamiento exterior de fachada', 'm2'],
      ['Reparación de balcón', 'unit'],
      ['Reparación de patio interior', 'm2'],
      ['Sellado de junta de fachada', 'ml'],
      ['Reparación de cornisa', 'ml'],
      ['Limpieza de fachada', 'm2'],
    ],
  },
  {
    name: 'Fontanería',
    concepts: [
      ['Tubería de agua fría y caliente', 'ml'],
      ['Llave de corte', 'unit'],
      ['Punto de agua', 'unit'],
      ['Desagüe', 'unit'],
      ['Bajante de saneamiento', 'ml'],
      ['Inodoro', 'unit'],
      ['Lavabo', 'unit'],
      ['Plato de ducha', 'unit'],
      ['Bañera', 'unit'],
      ['Grifería', 'unit'],
      ['Termo eléctrico', 'unit'],
      ['Calentador de agua', 'unit'],
      ['Bomba de agua', 'unit'],
      ['Filtro de agua', 'unit'],
      ['Detección y reparación de fuga', 'unit'],
    ],
  },
  {
    name: 'Gas',
    concepts: [
      ['Instalación interior de gas', 'ml'],
      ['Tubería de gas', 'ml'],
      ['Llave de gas', 'unit'],
      ['Conexión de aparato a gas', 'unit'],
      ['Conexión de caldera', 'unit'],
      ['Prueba de estanqueidad', 'unit'],
      ['Certificado de instalación de gas', 'unit'],
    ],
  },
  {
    name: 'Jardinería',
    concepts: [
      ['Preparación de terreno ajardinado', 'm2'],
      ['Aporte de tierra vegetal', 'm3'],
      ['Plantación', 'unit'],
      ['Poda de árbol o seto', 'unit'],
      ['Tala de árbol', 'unit'],
      ['Césped natural', 'm2'],
      ['Césped artificial', 'm2'],
      ['Sistema de riego', 'm2'],
      ['Drenaje de jardín', 'ml'],
    ],
  },
  {
    name: 'Limpieza',
    concepts: [
      ['Limpieza periódica de vivienda', 'hour'],
      ['Limpieza profunda', 'm2'],
      ['Limpieza de cristales', 'm2'],
      ['Pulido de suelos', 'm2'],
      ['Desinfección', 'm2'],
      ['Control de plagas', 'unit'],
    ],
  },
  {
    name: 'Mudanzas',
    concepts: [
      ['Embalaje de enseres', 'hour'],
      ['Desmontaje de muebles', 'unit'],
      ['Traslado de mobiliario', 'hour'],
      ['Guardamuebles', 'unit'],
      ['Protección de muebles durante la obra', 'unit'],
      ['Montaje de muebles en destino', 'unit'],
    ],
  },
  {
    name: 'Pavimentos',
    concepts: [
      ['Pavimento cerámico', 'm2'],
      ['Pavimento porcelánico', 'm2'],
      ['Pavimento de piedra o mármol', 'm2'],
      ['Parquet de madera', 'm2'],
      ['Tarima flotante', 'm2'],
      ['Suelo laminado', 'm2'],
      ['Suelo vinílico', 'm2'],
      ['Rodapié', 'ml'],
      ['Peldaño de pavimento', 'unit'],
      ['Rejuntado de pavimento', 'm2'],
      ['Pulido de pavimento', 'm2'],
      ['Nivelación de soporte', 'm2'],
    ],
  },
  {
    name: 'Pintura',
    concepts: [
      ['Preparación y lijado', 'm2'],
      ['Pintura plástica interior', 'm2'],
      ['Pintura de techos', 'm2'],
      ['Esmaltado de superficie', 'm2'],
      ['Lacado de carpintería', 'm2'],
      ['Papel pintado', 'm2'],
      ['Revestimiento decorativo', 'm2'],
      ['Tratamiento antihumedad', 'm2'],
      ['Tratamiento antimoho', 'm2'],
    ],
  },
  {
    name: 'Piscinas',
    concepts: [
      ['Vaso y estructura de piscina', 'm3'],
      ['Impermeabilización de piscina', 'm2'],
      ['Revestimiento de piscina', 'm2'],
      ['Coronación de piscina', 'ml'],
      ['Equipo de filtración', 'unit'],
      ['Bomba de piscina', 'unit'],
      ['Iluminación de piscina', 'unit'],
      ['Tratamiento de agua', 'unit'],
      ['Climatización de piscina', 'unit'],
      ['Cubierta de piscina', 'm2'],
      ['Detección y reparación de fuga', 'unit'],
    ],
  },
  {
    name: 'Pladur',
    concepts: [
      ['Tabique de placa de yeso', 'm2'],
      ['Placa hidrófuga', 'm2'],
      ['Placa resistente al fuego', 'm2'],
      ['Trasdosado de placa', 'm2'],
      ['Falso techo continuo', 'm2'],
      ['Falso techo registrable', 'm2'],
      ['Cajón de placa de yeso', 'ml'],
      ['Foseado de iluminación', 'ml'],
      ['Trampilla de registro', 'unit'],
      ['Reparación de juntas', 'm2'],
    ],
  },
  {
    name: 'Revestimientos',
    concepts: [
      ['Alicatado cerámico', 'm2'],
      ['Revestimiento de piedra en pared', 'm2'],
      ['Mosaico en pared', 'm2'],
      ['Panel decorativo de pared', 'm2'],
      ['Rejuntado de revestimiento', 'm2'],
      ['Reparación de piezas de revestimiento', 'unit'],
    ],
  },
  {
    name: 'Telecomunicaciones',
    concepts: [
      ['Toma de datos', 'unit'],
      ['Toma de televisión', 'unit'],
      ['Cableado de red', 'ml'],
      ['Tendido de fibra óptica', 'ml'],
      ['Antena de televisión', 'unit'],
      ['Portero o videoportero', 'unit'],
      ['Cámara de vigilancia', 'unit'],
      ['Sistema de alarma', 'unit'],
      ['Control de acceso', 'unit'],
      ['Automatización y domótica', 'unit'],
    ],
  },
  {
    name: 'Varios',
    concepts: [
      ['Visita técnica', 'unit'],
      ['Mediciones de vivienda', 'unit'],
      ['Licencia de obra y tasas', 'unit'],
      ['Montaje y alquiler de andamio', 'm2'],
      ['Protección de suelos y mobiliario', 'm2'],
      ['Limpieza final de obra', 'm2'],
      ['Mano de obra general', 'hour'],
    ],
  },
  {
    name: 'Ventanas',
    concepts: [
      ['Ventana de PVC', 'unit'],
      ['Ventana de aluminio', 'unit'],
      ['Ventana de madera', 'unit'],
      ['Persiana', 'unit'],
      ['Cajón de persiana', 'unit'],
      ['Mosquitera', 'unit'],
      ['Puerta de entrada', 'unit'],
      ['Cierre de terraza', 'm2'],
      ['Sellado perimetral de ventana', 'ml'],
      ['Reparación de herraje de ventana', 'unit'],
    ],
  },
  {
    name: 'Vidrio',
    concepts: [
      ['Mampara de ducha', 'unit'],
      ['Espejo', 'm2'],
      ['División acristalada', 'm2'],
      ['Vidrio de seguridad', 'm2'],
      ['Sustitución de cristal', 'm2'],
      ['Puerta de vidrio', 'unit'],
    ],
  },
];

const renovationCatalog: BaseCatalog = {
  id: 'reforma_integral',
  name: 'Reforma integral',
  description: 'Biblioteca completa de gremios y trabajos para reformas residenciales.',
  tariffs: renovationParts.flatMap((part) =>
    [...part.concepts]
      .sort(([a], [b]) => a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true }))
      .map(([description, unit]) => ({
        description,
        unit,
        basePrice: 0,
        cost: 0,
        category: part.name,
      })),
  ),
};

const specializedCatalogSeeds: {
  id: string;
  name: string;
  description: string;
  chapters: CatalogPartSeed[];
}[] = [
  {
    id: 'banos_aseos',
    name: 'Baños y aseos',
    description: 'Biblioteca especializada para renovar baños y aseos.',
    chapters: [
      {
        name: 'Demoliciones',
        concepts: [
          ['Desmontaje de sanitarios', 'unit'],
          ['Retirada de bañera o plato de ducha', 'unit'],
          ['Demolición de alicatado', 'm2'],
          ['Levantado de pavimento', 'm2'],
        ],
      },
      {
        name: 'Fontanería',
        concepts: [
          ['Punto de agua fría y caliente', 'unit'],
          ['Tubería de agua fría y caliente', 'ml'],
          ['Desagüe para lavabo o bidé', 'unit'],
          ['Llave de corte', 'unit'],
          ['Reubicación de toma de agua', 'unit'],
        ],
      },
      {
        name: 'Ducha y bañera',
        concepts: [
          ['Plato de ducha', 'unit'],
          ['Mampara de ducha', 'unit'],
          ['Columna de ducha', 'unit'],
          ['Bañera acrílica', 'unit'],
          ['Grifería de ducha empotrada', 'unit'],
          ['Formación de ducha de obra', 'unit'],
        ],
      },
      {
        name: 'Sanitarios',
        concepts: [
          ['Inodoro completo', 'unit'],
          ['Inodoro suspendido con bastidor', 'unit'],
          ['Lavabo', 'unit'],
          ['Bidé', 'unit'],
          ['Grifería de lavabo', 'unit'],
          ['Sifón y válvula de lavabo', 'unit'],
        ],
      },
      {
        name: 'Revestimientos',
        concepts: [
          ['Alicatado cerámico', 'm2'],
          ['Pavimento cerámico', 'm2'],
          ['Revestimiento continuo impermeable', 'm2'],
          ['Impermeabilización bajo alicatado', 'm2'],
          ['Rejuntado de revestimiento', 'm2'],
        ],
      },
      {
        name: 'Mobiliario',
        concepts: [
          ['Mueble de lavabo', 'unit'],
          ['Encimera de baño', 'ml'],
          ['Columna auxiliar de baño', 'unit'],
          ['Espejo de baño', 'unit'],
          ['Accesorios de baño', 'unit'],
        ],
      },
      {
        name: 'Electricidad',
        concepts: [
          ['Punto de luz de baño', 'unit'],
          ['Foco empotrado estanco', 'unit'],
          ['Enchufe protegido para baño', 'unit'],
          ['Extractor de baño', 'unit'],
          ['Espejo con iluminación', 'unit'],
        ],
      },
    ],
  },
  {
    id: 'cocinas',
    name: 'Cocinas',
    description: 'Biblioteca especializada para renovar o instalar cocinas.',
    chapters: [
      {
        name: 'Demoliciones',
        concepts: [
          ['Desmontaje de cocina existente', 'unit'],
          ['Retirada de encimera', 'ml'],
          ['Demolición de alicatado de cocina', 'm2'],
          ['Levantado de pavimento de cocina', 'm2'],
        ],
      },
      {
        name: 'Fontanería',
        concepts: [
          ['Punto de agua para fregadero', 'unit'],
          ['Desagüe para fregadero', 'unit'],
          ['Punto de agua para lavavajillas', 'unit'],
          ['Llave de corte de electrodoméstico', 'unit'],
          ['Instalación de fregadero', 'unit'],
          ['Instalación de grifo de cocina', 'unit'],
        ],
      },
      {
        name: 'Electricidad',
        concepts: [
          ['Circuito independiente para horno', 'unit'],
          ['Circuito independiente para placa', 'unit'],
          ['Enchufe de encimera', 'unit'],
          ['Enchufe para frigorífico', 'unit'],
          ['Punto eléctrico para campana', 'unit'],
          ['Punto de luz bajo mueble', 'unit'],
        ],
      },
      {
        name: 'Mobiliario',
        concepts: [
          ['Mueble bajo de cocina', 'ml'],
          ['Mueble alto de cocina', 'ml'],
          ['Columna para horno y microondas', 'unit'],
          ['Módulo extraíble de cocina', 'unit'],
          ['Frente de mueble de cocina', 'unit'],
          ['Montaje de muebles de cocina', 'ml'],
        ],
      },
      {
        name: 'Encimeras',
        concepts: [
          ['Encimera laminada', 'ml'],
          ['Encimera de cuarzo', 'ml'],
          ['Encimera de piedra natural', 'ml'],
          ['Copete de encimera', 'ml'],
          ['Hueco para fregadero en encimera', 'unit'],
          ['Hueco para placa en encimera', 'unit'],
        ],
      },
      {
        name: 'Revestimientos',
        concepts: [
          ['Frente de cocina cerámico', 'm2'],
          ['Panel decorativo de cocina', 'm2'],
          ['Pavimento de cocina', 'm2'],
          ['Rodapié de cocina', 'ml'],
          ['Pintura lavable de cocina', 'm2'],
        ],
      },
      {
        name: 'Electrodomésticos',
        concepts: [
          ['Horno', 'unit'],
          ['Placa de cocción', 'unit'],
          ['Campana extractora', 'unit'],
          ['Frigorífico integrado', 'unit'],
          ['Lavavajillas integrado', 'unit'],
          ['Microondas integrado', 'unit'],
          ['Montaje de electrodoméstico', 'unit'],
        ],
      },
    ],
  },
  {
    id: 'fachadas_cubiertas',
    name: 'Fachadas y cubiertas',
    description: 'Biblioteca para rehabilitar fachadas, terrazas y cubiertas.',
    chapters: [
      {
        name: 'Fachadas',
        concepts: [
          ['Reparación de enfoscado de fachada', 'm2'],
          ['Revestimiento de fachada', 'm2'],
          ['Reparación de fisuras en fachada', 'ml'],
          ['Sellado de junta de fachada', 'ml'],
          ['Reparación de cornisa', 'ml'],
          ['Limpieza de fachada', 'm2'],
        ],
      },
      {
        name: 'Aislamiento',
        concepts: [
          ['Sistema de aislamiento exterior SATE', 'm2'],
          ['Aislamiento insuflado en cámara', 'm2'],
          ['Aislamiento de medianera', 'm2'],
          ['Aislamiento de cubierta', 'm2'],
          ['Tratamiento de puente térmico', 'ml'],
        ],
      },
      {
        name: 'Cubiertas',
        concepts: [
          ['Reparación de tejado de teja', 'm2'],
          ['Sustitución de teja', 'm2'],
          ['Cubierta plana transitable', 'm2'],
          ['Cubierta inclinada', 'm2'],
          ['Lucernario de cubierta', 'unit'],
          ['Remate de cumbrera', 'ml'],
        ],
      },
      {
        name: 'Impermeabilización',
        concepts: [
          ['Lámina impermeabilizante de cubierta', 'm2'],
          ['Impermeabilización de terraza', 'm2'],
          ['Impermeabilización de balcón', 'm2'],
          ['Impermeabilización de encuentro y peto', 'ml'],
          ['Prueba de estanqueidad', 'unit'],
        ],
      },
      {
        name: 'Carpintería exterior',
        concepts: [
          ['Ventana de aluminio con rotura térmica', 'unit'],
          ['Puerta de acceso a cubierta', 'unit'],
          ['Persiana y cajón aislado', 'unit'],
          ['Sellado perimetral de carpintería', 'ml'],
          ['Barandilla de balcón', 'ml'],
        ],
      },
      {
        name: 'Evacuación',
        concepts: [
          ['Canalón', 'ml'],
          ['Bajante pluvial', 'ml'],
          ['Sumidero de cubierta', 'unit'],
          ['Rebosadero de terraza', 'unit'],
          ['Canaleta de drenaje de balcón', 'ml'],
        ],
      },
      {
        name: 'Medios auxiliares',
        concepts: [
          ['Montaje y alquiler de andamio', 'm2'],
          ['Plataforma elevadora', 'unit'],
          ['Línea de vida temporal', 'ml'],
          ['Protección de vía pública', 'unit'],
          ['Gestión de residuos de rehabilitación', 'm3'],
        ],
      },
    ],
  },
  {
    id: 'eficiencia_energetica',
    name: 'Eficiencia energética',
    description: 'Biblioteca para reducir consumo y mejorar el rendimiento energético.',
    chapters: [
      {
        name: 'Auditoría',
        concepts: [
          ['Visita de diagnóstico energético', 'unit'],
          ['Certificado de eficiencia energética', 'unit'],
          ['Termografía de envolvente', 'unit'],
          ['Estudio de puentes térmicos', 'unit'],
          ['Proyecto de rehabilitación energética', 'unit'],
        ],
      },
      {
        name: 'Aislamiento',
        concepts: [
          ['Aislamiento térmico interior', 'm2'],
          ['Aislamiento exterior SATE', 'm2'],
          ['Aislamiento insuflado en cámara', 'm2'],
          ['Aislamiento de cubierta', 'm2'],
          ['Aislamiento de suelo sobre local no calefactado', 'm2'],
          ['Sellado de infiltraciones de aire', 'ml'],
        ],
      },
      {
        name: 'Ventanas',
        concepts: [
          ['Ventana de PVC con vidrio bajo emisivo', 'unit'],
          ['Ventana de aluminio con rotura térmica', 'unit'],
          ['Doble acristalamiento bajo emisivo', 'm2'],
          ['Cajón de persiana aislado', 'ml'],
          ['Sellado de hueco de ventana', 'ml'],
        ],
      },
      {
        name: 'Climatización',
        concepts: [
          ['Bomba de calor aire-agua', 'unit'],
          ['Equipo de aerotermia', 'unit'],
          ['Sistema de suelo radiante', 'm2'],
          ['Sustitución de caldera por condensación', 'unit'],
          ['Válvula termostática de radiador', 'unit'],
          ['Equilibrado de circuito de calefacción', 'unit'],
        ],
      },
      {
        name: 'Ventilación',
        concepts: [
          ['Ventilación mecánica con recuperación de calor', 'unit'],
          ['Conducto de ventilación', 'ml'],
          ['Boca de impulsión o extracción', 'unit'],
          ['Sistema de renovación de aire por estancia', 'unit'],
          ['Limpieza de conductos de ventilación', 'ml'],
        ],
      },
      {
        name: 'Energía solar',
        concepts: [
          ['Panel fotovoltaico', 'unit'],
          ['Inversor fotovoltaico', 'unit'],
          ['Batería de almacenamiento', 'unit'],
          ['Sistema solar térmico para agua caliente', 'unit'],
          ['Punto de recarga de vehículo eléctrico', 'unit'],
        ],
      },
      {
        name: 'Control',
        concepts: [
          ['Termostato programable', 'unit'],
          ['Sistema de control domótico de climatización', 'unit'],
          ['Monitorización de consumo eléctrico', 'unit'],
          ['Monitorización de producción fotovoltaica', 'unit'],
          ['Configuración de gestión energética', 'unit'],
        ],
      },
    ],
  },
  {
    id: 'exteriores_jardines',
    name: 'Exteriores y jardines',
    description: 'Biblioteca para patios, terrazas, accesos y zonas ajardinadas.',
    chapters: [
      {
        name: 'Preparación',
        concepts: [
          ['Limpieza y desbroce de parcela', 'm2'],
          ['Excavación y retirada de terreno', 'm3'],
          ['Nivelación y compactación', 'm2'],
          ['Aporte de tierra vegetal', 'm3'],
        ],
      },
      {
        name: 'Pavimentos',
        concepts: [
          ['Pavimento exterior antideslizante', 'm2'],
          ['Tarima tecnológica exterior', 'm2'],
          ['Adoquín para acceso y patio', 'm2'],
          ['Solera de hormigón exterior', 'm2'],
          ['Bordillo de jardín', 'ml'],
        ],
      },
      {
        name: 'Cerramientos',
        concepts: [
          ['Vallado metálico', 'ml'],
          ['Muro de bloque para jardín', 'm2'],
          ['Puerta peatonal exterior', 'unit'],
          ['Puerta de acceso para vehículos', 'unit'],
          ['Celosía de ocultación', 'm2'],
        ],
      },
      {
        name: 'Jardinería',
        concepts: [
          ['Plantación de árbol', 'unit'],
          ['Plantación de seto', 'ml'],
          ['Plantación de arbusto', 'unit'],
          ['Suministro e instalación de césped natural', 'm2'],
          ['Suministro e instalación de césped artificial', 'm2'],
          ['Poda y retirada de restos vegetales', 'hour'],
        ],
      },
      {
        name: 'Riego',
        concepts: [
          ['Red de riego por goteo', 'ml'],
          ['Difusor de riego emergente', 'unit'],
          ['Programador de riego', 'unit'],
          ['Electroválvula de riego', 'unit'],
          ['Instalación de depósito de agua', 'unit'],
        ],
      },
      {
        name: 'Iluminación',
        concepts: [
          ['Punto de luz exterior', 'unit'],
          ['Baliza de jardín', 'unit'],
          ['Proyector exterior', 'unit'],
          ['Canalización eléctrica enterrada', 'ml'],
          ['Detector de presencia exterior', 'unit'],
        ],
      },
      {
        name: 'Drenaje',
        concepts: [
          ['Canaleta de drenaje exterior', 'ml'],
          ['Sumidero de patio', 'unit'],
          ['Drenaje francés de jardín', 'ml'],
          ['Pozo de recogida de aguas', 'unit'],
          ['Impermeabilización de muro enterrado', 'm2'],
        ],
      },
      {
        name: 'Equipamiento',
        concepts: [
          ['Pérgola exterior', 'm2'],
          ['Cenador de jardín', 'unit'],
          ['Barbacoa de obra', 'unit'],
          ['Mobiliario exterior', 'unit'],
          ['Ducha de jardín', 'unit'],
        ],
      },
    ],
  },
  {
    id: 'piscinas',
    name: 'Piscinas',
    description: 'Biblioteca para construir, renovar y equipar piscinas.',
    chapters: [
      {
        name: 'Excavación',
        concepts: [
          ['Excavación para vaso de piscina', 'm3'],
          ['Retirada de tierras de excavación', 'm3'],
          ['Compactación del fondo del vaso', 'm2'],
          ['Hormigón de limpieza de piscina', 'm2'],
        ],
      },
      {
        name: 'Estructura',
        concepts: [
          ['Vaso de piscina de hormigón armado', 'm2'],
          ['Vaso de piscina de bloque armado', 'm2'],
          ['Escalera de obra para piscina', 'unit'],
          ['Banco interior de obra', 'ml'],
          ['Coronación de piscina', 'ml'],
        ],
      },
      {
        name: 'Impermeabilización',
        concepts: [
          ['Impermeabilización cementosa de vaso', 'm2'],
          ['Lámina armada para piscina', 'm2'],
          ['Prueba de estanqueidad del vaso', 'unit'],
          ['Sellado de juntas de piscina', 'ml'],
        ],
      },
      {
        name: 'Revestimientos',
        concepts: [
          ['Revestimiento de gresite', 'm2'],
          ['Revestimiento cerámico de piscina', 'm2'],
          ['Mosaico para piscina', 'm2'],
          ['Rejuntado epoxi de piscina', 'm2'],
          ['Reparación de coronación', 'ml'],
        ],
      },
      {
        name: 'Fontanería',
        concepts: [
          ['Tubería de impulsión de piscina', 'ml'],
          ['Tubería de aspiración de piscina', 'ml'],
          ['Skimmer', 'unit'],
          ['Boquilla de impulsión', 'unit'],
          ['Sumidero de fondo', 'unit'],
          ['Toma limpiafondos', 'unit'],
        ],
      },
      {
        name: 'Depuración',
        concepts: [
          ['Bomba de filtración', 'unit'],
          ['Filtro de arena', 'unit'],
          ['Válvula selectora', 'unit'],
          ['Clorador salino', 'unit'],
          ['Cuadro eléctrico de piscina', 'unit'],
          ['Puesta en marcha del sistema de depuración', 'unit'],
        ],
      },
      {
        name: 'Climatización',
        concepts: [
          ['Bomba de calor para piscina', 'unit'],
          ['Cubierta térmica de piscina', 'm2'],
          ['Enrollador de cubierta térmica', 'unit'],
          ['Intercambiador de calor', 'unit'],
        ],
      },
      {
        name: 'Seguridad y entorno',
        concepts: [
          ['Valla de seguridad para piscina', 'ml'],
          ['Cubierta de seguridad', 'm2'],
          ['Iluminación subacuática', 'unit'],
          ['Ducha exterior para piscina', 'unit'],
          ['Pavimento antideslizante de playa', 'm2'],
        ],
      },
    ],
  },
  {
    id: 'accesibilidad',
    name: 'Accesibilidad',
    description: 'Biblioteca para adaptar viviendas y espacios comunes.',
    chapters: [
      {
        name: 'Rampas',
        concepts: [
          ['Rampa accesible de obra', 'm2'],
          ['Rampa modular portátil', 'unit'],
          ['Formación de pendiente accesible', 'm2'],
          ['Pavimento podotáctil de advertencia', 'm2'],
          ['Pasamanos de rampa', 'ml'],
        ],
      },
      {
        name: 'Puertas',
        concepts: [
          ['Ampliación de hueco de paso', 'unit'],
          ['Puerta de paso accesible', 'unit'],
          ['Automatización de puerta', 'unit'],
          ['Herraje ergonómico de puerta', 'unit'],
          ['Puerta corredera accesible', 'unit'],
        ],
      },
      {
        name: 'Baños',
        concepts: [
          ['Adaptación de ducha a nivel', 'unit'],
          ['Asiento abatible de ducha', 'unit'],
          ['Barra de apoyo abatible', 'unit'],
          ['Inodoro accesible', 'unit'],
          ['Lavabo suspendido accesible', 'unit'],
          ['Mampara accesible', 'unit'],
        ],
      },
      {
        name: 'Itinerarios',
        concepts: [
          ['Eliminación de resalto en acceso', 'unit'],
          ['Pavimento continuo antideslizante', 'm2'],
          ['Pasamanos de pared', 'ml'],
          ['Barandilla accesible', 'ml'],
          ['Adecuación de recorrido interior', 'm2'],
        ],
      },
      {
        name: 'Elevación',
        concepts: [
          ['Plataforma salvaescaleras inclinada', 'unit'],
          ['Plataforma elevadora vertical', 'unit'],
          ['Elevador doméstico', 'unit'],
          ['Silla salvaescaleras', 'unit'],
          ['Adecuación eléctrica para elevador', 'unit'],
        ],
      },
      {
        name: 'Señalización',
        concepts: [
          ['Señalización táctil en pavimento', 'ml'],
          ['Placa identificativa en braille', 'unit'],
          ['Señalización visual de alto contraste', 'unit'],
          ['Avisador acústico y luminoso', 'unit'],
        ],
      },
      {
        name: 'Equipamiento',
        concepts: [
          ['Videoportero accesible', 'unit'],
          ['Grifería con mando ergonómico', 'unit'],
          ['Mecanismo eléctrico accesible', 'unit'],
          ['Adaptación de altura de buzón', 'unit'],
        ],
      },
    ],
  },
  {
    id: 'locales_comerciales',
    name: 'Locales comerciales',
    description: 'Biblioteca para acondicionar locales y espacios de atención al público.',
    chapters: [
      {
        name: 'Demoliciones',
        concepts: [
          ['Desmontaje de acondicionamiento existente', 'm2'],
          ['Demolición de tabique interior', 'm2'],
          ['Retirada de falso techo', 'm2'],
          ['Carga y retirada de escombros', 'm3'],
        ],
      },
      {
        name: 'Distribución',
        concepts: [
          ['Tabique de distribución', 'm2'],
          ['Tabique acústico de local', 'm2'],
          ['Mampara divisoria', 'm2'],
          ['Puerta interior de local', 'unit'],
          ['Mostrador de atención a medida', 'ml'],
        ],
      },
      {
        name: 'Electricidad',
        concepts: [
          ['Cuadro eléctrico de local', 'unit'],
          ['Circuito eléctrico para maquinaria', 'unit'],
          ['Base de enchufe de uso comercial', 'unit'],
          ['Canalización eléctrica de suelo', 'ml'],
          ['Certificado de instalación eléctrica', 'unit'],
        ],
      },
      {
        name: 'Iluminación',
        concepts: [
          ['Carril electrificado para focos', 'ml'],
          ['Foco LED orientable', 'unit'],
          ['Panel LED de techo', 'unit'],
          ['Iluminación de emergencia', 'unit'],
          ['Iluminación de escaparate', 'unit'],
        ],
      },
      {
        name: 'Climatización',
        concepts: [
          ['Equipo de climatización comercial', 'unit'],
          ['Conducto de climatización', 'ml'],
          ['Rejilla de impulsión o retorno', 'unit'],
          ['Ventilación mecánica de local', 'unit'],
          ['Cortina de aire para acceso', 'unit'],
        ],
      },
      {
        name: 'Datos y seguridad',
        concepts: [
          ['Punto de red de datos', 'unit'],
          ['Canalización para telecomunicaciones', 'ml'],
          ['Cámara de videovigilancia', 'unit'],
          ['Sistema de alarma de intrusión', 'unit'],
          ['Control de acceso', 'unit'],
        ],
      },
      {
        name: 'Acabados',
        concepts: [
          ['Pavimento de alto tránsito', 'm2'],
          ['Revestimiento decorativo de pared', 'm2'],
          ['Falso techo registrable', 'm2'],
          ['Pintura de local comercial', 'm2'],
          ['Rótulo interior', 'unit'],
        ],
      },
      {
        name: 'Accesibilidad y PCI',
        concepts: [
          ['Adecuación de acceso accesible', 'unit'],
          ['Aseo accesible de local', 'unit'],
          ['Extintor portátil', 'unit'],
          ['Señalización de evacuación', 'unit'],
          ['Puerta cortafuegos', 'unit'],
          ['Detector de incendios', 'unit'],
        ],
      },
    ],
  },
  {
    id: 'garajes_sotanos',
    name: 'Garajes y sótanos',
    description: 'Biblioteca para rehabilitar garajes, aparcamientos y espacios bajo rasante.',
    chapters: [
      {
        name: 'Preparación',
        concepts: [
          ['Vaciado y limpieza de garaje', 'm2'],
          ['Retirada de vehículos y enseres', 'unit'],
          ['Demolición de solera deteriorada', 'm2'],
          ['Gestión de residuos de garaje', 'm3'],
        ],
      },
      {
        name: 'Estructura',
        concepts: [
          ['Reparación de pilar de hormigón', 'unit'],
          ['Reparación de viga de hormigón', 'ml'],
          ['Refuerzo de forjado', 'm2'],
          ['Reparación de fisura estructural', 'ml'],
          ['Protección anticorrosiva de armadura', 'm2'],
        ],
      },
      {
        name: 'Impermeabilización y drenaje',
        concepts: [
          ['Impermeabilización de muro enterrado', 'm2'],
          ['Sellado de filtración en sótano', 'unit'],
          ['Drenaje perimetral de sótano', 'ml'],
          ['Canaleta de recogida de agua', 'ml'],
          ['Bomba de achique', 'unit'],
        ],
      },
      {
        name: 'Pavimentos',
        concepts: [
          ['Pavimento de hormigón pulido', 'm2'],
          ['Pavimento de resina para garaje', 'm2'],
          ['Reparación de solera', 'm2'],
          ['Pintura de señalización vial', 'ml'],
          ['Numeración de plaza de aparcamiento', 'unit'],
        ],
      },
      {
        name: 'Puertas y ventilación',
        concepts: [
          ['Puerta seccional de garaje', 'unit'],
          ['Puerta basculante de garaje', 'unit'],
          ['Motor de puerta de garaje', 'unit'],
          ['Rejilla de ventilación de garaje', 'unit'],
          ['Sistema de extracción de CO', 'unit'],
        ],
      },
      {
        name: 'Electricidad y recarga',
        concepts: [
          ['Punto de luz de garaje', 'unit'],
          ['Luminaria estanca de garaje', 'unit'],
          ['Detector de presencia', 'unit'],
          ['Punto de recarga de vehículo eléctrico', 'unit'],
          ['Canalización para recarga eléctrica', 'ml'],
        ],
      },
      {
        name: 'Protección contra incendios',
        concepts: [
          ['Extintor para garaje', 'unit'],
          ['Boca de incendio equipada', 'unit'],
          ['Detector de incendios', 'unit'],
          ['Señal de evacuación', 'unit'],
          ['Pintura intumescente en estructura', 'm2'],
        ],
      },
      {
        name: 'Trasteros',
        concepts: [
          ['Tabique de separación de trastero', 'm2'],
          ['Puerta metálica de trastero', 'unit'],
          ['Rejilla de ventilación de trastero', 'unit'],
          ['Instalación eléctrica de trastero', 'unit'],
          ['Numeración de trastero', 'unit'],
        ],
      },
    ],
  },
];

const createSpecializedCatalog = (seed: (typeof specializedCatalogSeeds)[number]): BaseCatalog => ({
  id: seed.id,
  name: seed.name,
  description: seed.description,
  tariffs: [...seed.chapters]
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base', numeric: true }))
    .flatMap((chapter) =>
      [...chapter.concepts]
        .sort(([a], [b]) => a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true }))
        .map(([description, unit]) => ({
          description,
          unit,
          basePrice: 0,
          cost: 0,
          category: chapter.name,
        })),
    ),
});

const specializedCatalogs = specializedCatalogSeeds.map(createSpecializedCatalog);

export const BASE_CATALOGS: BaseCatalog[] = [
  {
    id: 'en_blanco',
    name: 'En blanco',
    description: 'Catálogo vacío para empezar desde cero.',
    tariffs: [],
  },
  renovationCatalog,
];

export const TRADE_CATALOGS: BaseCatalog[] = [...specializedCatalogs, renovationCatalog];
