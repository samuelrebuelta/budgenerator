import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Upload, Trash2, Info } from 'lucide-react';
import { useProfileStore } from '@/entities/profile';
import { useAuthStore } from '@/entities/auth';
import { isValidPrivacyPolicyUrl } from '@/entities/quote-estimator';
import { MAX_LOGO_SIZE } from '@/shared/lib';
import { Button, ConfirmModal, Input, PageLayout, PageHeader } from '@/shared/ui';
import { ProfileSkeleton } from './components/ProfileSkeleton';
import { t } from '@/shared/i18n';

export function ProfilePage() {
  const profile = useProfileStore((s) => s.profile);
  const loaded = useProfileStore((s) => s.loaded);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const saveProfile = useProfileStore((s) => s.saveProfile);
  const storeUploadLogo = useProfileStore((s) => s.uploadLogo);
  const removeLogo = useProfileStore((s) => s.removeLogo);
  const authEmail = useAuthStore((s) => s.user?.email ?? '');
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showRemoveLogoConfirm, setShowRemoveLogoConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const privacyUrl = profile.privacyPolicyUrl?.trim() ?? '';
      if (privacyUrl && !isValidPrivacyPolicyUrl(privacyUrl)) {
        setError('El aviso de privacidad debe tener una URL HTTPS válida.');
        return;
      }
      await saveProfile();
      navigate('/budgets');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se han podido guardar los datos.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > MAX_LOGO_SIZE) {
      alert(t('profile.logoTooLarge'));
      return;
    }
    setUploading(true);
    setError('');
    try {
      await storeUploadLogo(file);
    } catch {
      setError('No se ha podido guardar el logo. Prueba con otra imagen.');
    } finally {
      setUploading(false);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleRemoveLogo = async () => {
    setShowRemoveLogoConfirm(false);
    setUploading(true);
    setError('');
    try {
      await removeLogo();
    } catch {
      setError('No se ha podido eliminar el logo. Vuelve a intentarlo.');
    } finally {
      setUploading(false);
    }
  };

  if (!loaded) {
    return <ProfileSkeleton />;
  }

  return (
    <PageLayout>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <fieldset disabled={saving || uploading} className="min-w-0">
        <PageHeader
          title={t('profile.title')}
          description="Estos datos aparecen en tus presupuestos y documentos."
          backTo="/projects"
          backLabel="Volver a proyectos"
        />
        <div className="flex items-start gap-2 bg-blue-50 text-blue-700 text-sm rounded-lg px-3 py-2 mb-6">
          <Info size={16} className="shrink-0 mt-0.5" />
          <span>{t('profile.disclaimer')}</span>
        </div>

        {/* Logo */}
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700 block mb-2">
            {t('profile.logo')}
          </label>
          {profile.logo ? (
            <div className="flex items-center gap-4">
              <img
                src={profile.logo}
                alt="Logo de empresa"
                className="h-16 w-auto object-contain rounded border border-gray-200 bg-white p-1"
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowRemoveLogoConfirm(true)}
                disabled={uploading}
                loading={uploading}
                className="text-sm text-red-500 hover:text-red-700"
              >
                <Trash2 size={14} />
                {t('profile.removeLogo')}
              </Button>
            </div>
          ) : (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => fileRef.current?.click()}
                loading={uploading}
                className="flex items-center gap-2 border-2 border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600"
              >
                <Upload size={16} />
                {uploading ? t('profile.uploading') : t('profile.uploadLogo')}
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="companyName"
            label={t('profile.companyName')}
            data-tour="company-profile"
            value={profile.name}
            onChange={(e) => updateProfile({ name: e.target.value })}
            placeholder={t('profile.companyNamePlaceholder')}
          />
          <Input
            id="cif"
            label={t('profile.cif')}
            value={profile.cif}
            onChange={(e) => updateProfile({ cif: e.target.value })}
            placeholder={t('profile.cifPlaceholder')}
          />
          <Input
            id="companyAddress"
            label={t('profile.address')}
            value={profile.address}
            onChange={(e) => updateProfile({ address: e.target.value })}
            placeholder={t('profile.addressPlaceholder')}
          />
          <Input
            id="phone"
            label={t('profile.phone')}
            type="tel"
            value={profile.phone}
            onChange={(e) => updateProfile({ phone: e.target.value })}
            placeholder={t('profile.phonePlaceholder')}
          />
          <Input
            id="companyEmail"
            label={t('profile.email')}
            type="email"
            value={authEmail}
            readOnly
            className="bg-gray-100 text-gray-500 cursor-not-allowed"
          />
          <Input
            id="privacyPolicyUrl"
            label="URL del aviso de privacidad"
            type="url"
            value={profile.privacyPolicyUrl ?? ''}
            onChange={(e) => updateProfile({ privacyPolicyUrl: e.target.value })}
            placeholder="https://tuempresa.es/privacidad"
          />
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Es necesario para recibir solicitudes desde el formulario público. Solo se aceptan enlaces
          seguros HTTPS.
        </p>

        <div className="mt-8 flex justify-end">
          <Button onClick={handleSave} loading={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
        <div className="mt-10 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="font-semibold text-gray-900">Estimador público</h2>
            <p className="mt-1 max-w-xl text-sm text-gray-600">
              Gestiona las estancias, tarifas y enlace público.
            </p>
          </div>
          <Link
            to="/estimator"
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg px-3 text-sm font-semibold text-[#426457] underline underline-offset-4 hover:text-[#234c40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#426457] sm:self-auto"
          >
            Ver
          </Link>
        </div>
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="font-semibold text-gray-900">Solicitudes recibidas</h2>
            <p className="mt-1 text-sm text-gray-600">
              Consulta los datos de contacto y el resumen de cada reforma solicitada.
            </p>
          </div>
          <Link
            to="/profile/solicitudes"
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg px-3 text-sm font-semibold text-[#426457] underline underline-offset-4 hover:text-[#234c40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#426457] sm:self-auto"
          >
            Ver
          </Link>
        </div>
      </fieldset>

      <ConfirmModal
        open={showRemoveLogoConfirm}
        onClose={() => setShowRemoveLogoConfirm(false)}
        title={t('profile.removeLogoTitle')}
        message={t('profile.removeLogoMessage')}
        confirmLabel={t('common.delete')}
        onConfirm={handleRemoveLogo}
      />
    </PageLayout>
  );
}
