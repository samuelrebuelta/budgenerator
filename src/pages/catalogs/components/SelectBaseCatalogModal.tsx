import { X } from 'lucide-react';
import { BASE_CATALOGS } from '@/entities/catalog';
import { t } from '@/shared/i18n';
import { Modal } from '@/shared/ui';

interface SelectBaseCatalogModalProps {
  isOpen: boolean;
  onSelect: (catalogId: string) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function SelectBaseCatalogModal({
  isOpen,
  onSelect,
  onClose,
  isLoading = false,
}: SelectBaseCatalogModalProps) {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      panelClassName="max-w-2xl max-h-[90vh] overflow-y-auto p-0"
    >
      <div>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {t('catalog.selectBaseCatalog')}
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-600 mb-6">
            {t('catalog.selectBaseCatalogDescription')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {BASE_CATALOGS.map((catalog) => (
              <button
                key={catalog.id}
                onClick={() => onSelect(catalog.id)}
                disabled={isLoading}
                className="cursor-pointer text-left p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <h3 className="font-semibold text-gray-900 mb-1">
                  {catalog.name}
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  {catalog.description}
                </p>
                <p className="text-xs text-gray-500">
                  {catalog.tariffs.length} {t('catalog.items')}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
