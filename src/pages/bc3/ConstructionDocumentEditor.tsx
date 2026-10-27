import type {
  ConstructionDocument,
  FiebdcMeasurementLine,
  FiebdcNode,
} from '@/entities/construction-document/model';
import {
  updateConstructionMeasurementFactor,
  updateConstructionConcept,
  updateConstructionNodeMeasurements,
} from '@/entities/construction-document/model';

interface Props {
  document: ConstructionDocument;
  onChange: (document: ConstructionDocument) => void;
}

const inputClass =
  'min-h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900';

function NodeEditor({
  node,
  document,
  onChange,
  depth = 0,
}: {
  node: FiebdcNode;
  document: ConstructionDocument;
  onChange: Props['onChange'];
  depth?: number;
}) {
  const concept = Object.values(document.concepts).find((item) =>
    item.codes.includes(node.conceptCode),
  );
  if (!concept) return null;
  const priceLabel = document.header.priceLabels?.[0] ?? concept.prices[0]?.label ?? 'Venta';
  const price = concept.prices.find((item) => item.label === priceLabel)?.amount.raw ?? '';

  const updateConcept = (patch: {
    summary?: string;
    unit?: string;
    prices?: typeof concept.prices;
  }) => onChange(updateConstructionConcept(document, node.conceptCode, patch));
  const updateMeasurements = (measurements: FiebdcMeasurementLine[]) =>
    onChange(updateConstructionNodeMeasurements(document, node.id, measurements));
  const updateMeasurement = (index: number, patch: Partial<FiebdcMeasurementLine>) =>
    updateMeasurements(
      node.measurements.map((measurement, current) =>
        current === index ? { ...measurement, ...patch } : measurement,
      ),
    );
  const updateFactor = (
    index: number,
    factor: 'units' | 'length' | 'breadth' | 'height',
    raw: string,
  ) => onChange(updateConstructionMeasurementFactor(document, node.id, index, factor, raw));

  return (
    <li className="space-y-3" data-concept-code={node.conceptCode}>
      <div
        className="grid gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_6rem_8rem]"
        style={{ marginLeft: depth ? `${Math.min(depth, 4) * 0.75}rem` : undefined }}
      >
        <label className="text-xs font-medium text-gray-600">
          <span className="mb-1 block">{node.conceptCode}</span>
          <input
            aria-label={`Descripción ${node.conceptCode}`}
            className={inputClass}
            value={concept.summary}
            onChange={(event) => updateConcept({ summary: event.currentTarget.value })}
          />
        </label>
        <label className="text-xs font-medium text-gray-600">
          <span className="mb-1 block">Unidad</span>
          <input
            aria-label={`Unidad ${node.conceptCode}`}
            className={inputClass}
            value={concept.unit}
            onChange={(event) => updateConcept({ unit: event.currentTarget.value })}
          />
        </label>
        <label className="text-xs font-medium text-gray-600">
          <span className="mb-1 block">
            {priceLabel} (€/{concept.unit || 'ud'})
          </span>
          {concept.decomposition.length ? (
            <span className="flex min-h-10 items-center text-sm text-gray-500">
              Por descomposición
            </span>
          ) : (
            <input
              aria-label={`Precio ${node.conceptCode}`}
              className={inputClass}
              inputMode="decimal"
              value={price}
              onChange={(event) => {
                const amount = event.currentTarget.value;
                const prices = concept.prices.some((item) => item.label === priceLabel)
                  ? concept.prices.map((item) =>
                      item.label === priceLabel ? { ...item, amount: { raw: amount } } : item,
                    )
                  : [...concept.prices, { label: priceLabel, amount: { raw: amount } }];
                updateConcept({ prices });
              }}
            />
          )}
        </label>
      </div>
      {!node.children.length && (
        <details className="ml-3 rounded-lg bg-gray-50 px-3 py-2 sm:ml-6">
          <summary className="cursor-pointer py-1 text-sm font-medium text-gray-700">
            Mediciones ({node.measurements.length})
          </summary>
          <div className="mt-2 space-y-3">
            {node.measurements.map((measurement, index) => (
              <div key={`${measurement.position ?? index}-${index}`} className="space-y-2">
                {(['units', 'length', 'breadth', 'height'] as const).some(
                  (factor) => measurement[factor],
                ) ? (
                  <div className="grid gap-2 sm:grid-cols-4">
                    {(['units', 'length', 'breadth', 'height'] as const).map((factor) => (
                      <label key={factor} className="text-xs text-gray-600">
                        <span className="mb-1 block">
                          {
                            {
                              units: 'Unidades',
                              length: 'Largo',
                              breadth: 'Ancho',
                              height: 'Alto',
                            }[factor]
                          }
                        </span>
                        <input
                          aria-label={`${{ units: 'Unidades', length: 'Largo', breadth: 'Ancho', height: 'Alto' }[factor]} ${node.conceptCode} ${index + 1}`}
                          className={inputClass}
                          inputMode="decimal"
                          value={measurement[factor]?.raw ?? ''}
                          onChange={(event) =>
                            updateFactor(index, factor, event.currentTarget.value)
                          }
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <label className="block text-xs text-gray-600">
                    <span className="mb-1 block">Cantidad total</span>
                    <input
                      aria-label={`Cantidad ${node.conceptCode} ${index + 1}`}
                      className={inputClass}
                      inputMode="decimal"
                      value={measurement.total?.raw ?? ''}
                      onChange={(event) =>
                        updateMeasurement(index, { total: { raw: event.currentTarget.value } })
                      }
                    />
                  </label>
                )}
                <label className="text-xs text-gray-600">
                  <span className="mb-1 block">Nota de medición</span>
                  <input
                    aria-label={`Nota ${node.conceptCode} ${index + 1}`}
                    className={inputClass}
                    value={measurement.comment ?? ''}
                    onChange={(event) =>
                      updateMeasurement(index, { comment: event.currentTarget.value })
                    }
                  />
                </label>
              </div>
            ))}
            <button
              className="min-h-10 rounded-md px-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
              type="button"
              onClick={() =>
                updateMeasurements([
                  ...node.measurements,
                  {
                    position: String(node.measurements.length + 1),
                    sourceType: '1',
                    total: { raw: '0' },
                  },
                ])
              }
            >
              Añadir medición
            </button>
          </div>
        </details>
      )}
      {node.children.length > 0 && (
        <ul className="space-y-3" aria-label={`Descomposición ${concept.summary}`}>
          {node.children.map((child) => (
            <NodeEditor
              key={child.id}
              node={child}
              document={document}
              onChange={onChange}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ConstructionDocumentEditor({ document, onChange }: Props) {
  const rootCodes = new Set(document.roots.map((node) => node.conceptCode));
  const unplacedConcepts = Object.values(document.concepts).filter(
    (concept) => !rootCodes.has(concept.codes[0] ?? ''),
  );
  return (
    <section aria-label="Editor de documento FIEBDC" className="mt-6 space-y-5">
      <label className="block max-w-2xl text-sm font-medium text-gray-700">
        Nombre del documento
        <input
          className={`${inputClass} mt-1`}
          value={document.header.title}
          onChange={(event) =>
            onChange({
              ...document,
              header: { ...document.header, title: event.currentTarget.value },
            })
          }
        />
      </label>
      {document.roots.length ? (
        <ul className="space-y-4">
          {document.roots.map((node) => (
            <NodeEditor key={node.id} node={node} document={document} onChange={onChange} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-600">
          Este catálogo contiene conceptos sin estructura jerárquica.
        </p>
      )}
      {unplacedConcepts.length > 0 && (
        <ul className="space-y-3" aria-label="Conceptos del catálogo">
          {unplacedConcepts.map((concept) => (
            <li
              key={concept.id}
              className="grid gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_6rem_8rem]"
            >
              <label className="text-xs font-medium text-gray-600">
                <span className="mb-1 block">{concept.codes[0]}</span>
                <input
                  aria-label={`Descripción ${concept.codes[0]}`}
                  className={inputClass}
                  value={concept.summary}
                  onChange={(event) =>
                    onChange(
                      updateConstructionConcept(document, concept.codes[0]!, {
                        summary: event.currentTarget.value,
                      }),
                    )
                  }
                />
              </label>
              <label className="text-xs font-medium text-gray-600">
                <span className="mb-1 block">Unidad</span>
                <input
                  aria-label={`Unidad ${concept.codes[0]}`}
                  className={inputClass}
                  value={concept.unit}
                  onChange={(event) =>
                    onChange(
                      updateConstructionConcept(document, concept.codes[0]!, {
                        unit: event.currentTarget.value,
                      }),
                    )
                  }
                />
              </label>
              <label className="text-xs font-medium text-gray-600">
                <span className="mb-1 block">{concept.prices[0]?.label ?? 'Precio'}</span>
                {concept.decomposition.length ? (
                  <span className="flex min-h-10 items-center text-sm text-gray-500">
                    Por descomposición
                  </span>
                ) : (
                  <input
                    aria-label={`Precio ${concept.codes[0]}`}
                    className={inputClass}
                    inputMode="decimal"
                    value={concept.prices[0]?.amount.raw ?? ''}
                    onChange={(event) =>
                      onChange(
                        updateConstructionConcept(document, concept.codes[0]!, {
                          prices: concept.prices.length
                            ? concept.prices.map((price, index) =>
                                index === 0
                                  ? { ...price, amount: { raw: event.currentTarget.value } }
                                  : price,
                              )
                            : [{ label: 'Venta', amount: { raw: event.currentTarget.value } }],
                        }),
                      )
                    }
                  />
                )}
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
