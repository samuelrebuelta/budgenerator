import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Plus } from 'lucide-react';
import { useCatalogStore } from '@/entities/catalog';
import { Button } from '@/shared/ui';
import { CatalogSkeleton } from './components/CatalogSkeleton';
import { SelectBaseCatalogModal } from './components/SelectBaseCatalogModal';
import { t } from '@/shared/i18n';
import { catalogSummary } from './catalogSummary';

export function CatalogsPage() {
  const catalogs = useCatalogStore((state) => state.catalogs);
  const loaded = useCatalogStore((state) => state.loaded);
  const activeCatalogId = useCatalogStore((state) => state.activeCatalogId);
  const createCatalogFromBase = useCatalogStore((state) => state.createCatalogFromBase);
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const openCreate = () => {
    setError('');
    setShowCreate(true);
  };
  const handleCreate = async (baseId: string) => {
    if (creating) return;
    setCreating(true);
    setError('');
    try {
      const id = await createCatalogFromBase(baseId);
      if (id) navigate(`/catalogs/${id}`);
    } catch {
      setError(t('catalog.createError'));
    } finally {
      setCreating(false);
    }
  };
  return (
    <div className="page-container">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{t('catalog.libraryEyebrow')}</p>
          <h1>{t('catalog.title')}</h1>
          <p>{t('catalog.listDescription')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} />
          {t('catalog.createFromBase')}
        </Button>
      </header>
      {!loaded ? (
        <CatalogSkeleton />
      ) : catalogs.length === 0 ? (
        <div className="catalog-empty">
          <BookOpen size={36} aria-hidden="true" />
          <h2>{t('catalog.emptyTitle')}</h2>
          <p>{t('catalog.emptyDescription')}</p>
          <Button variant="secondary" onClick={openCreate}>
            {t('catalog.createFirst')}
          </Button>
        </div>
      ) : (
        <section aria-label={t('catalog.savedCatalogs')}>
          <div className="list-heading">
            <h2>
              {t('catalog.savedCatalogs')}
              <span aria-hidden="true">{catalogs.length}</span>
            </h2>
          </div>
          <ul className="catalog-list">
            {catalogs.map((catalog) => (
              <li key={catalog.id}>
                <Link className="catalog-list-row" to={`/catalogs/${catalog.id}`}>
                  <span className="catalog-list-icon">
                    <BookOpen size={22} aria-hidden="true" />
                  </span>
                  <div className="catalog-list-copy">
                    <h2>{catalog.name}</h2>
                    <p>{catalogSummary(catalog.tariffs)}</p>
                  </div>
                  {activeCatalogId === catalog.id && (
                    <span className="catalog-default-badge">{t('catalog.defaultCatalog')}</span>
                  )}
                  <ArrowUpRight className="catalog-list-arrow" size={18} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <SelectBaseCatalogModal
        isOpen={showCreate}
        onSelect={handleCreate}
        onClose={() => {
          if (!creating) setShowCreate(false);
        }}
        isLoading={creating}
        error={error}
      />
    </div>
  );
}
