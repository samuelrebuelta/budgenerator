import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Trash2, Info } from 'lucide-react';
import { useProfileStore } from '@/entities/profile';
import { useAuthStore } from '@/entities/auth';
import { Button, Input, Modal } from '@/shared/ui';
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
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showRemoveLogoConfirm, setShowRemoveLogoConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setSaving(true);
    await saveProfile();
    setSaving(false);
    navigate('/');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 500 * 1024) {
      alert(t('profile.logoTooLarge'));
      return;
    }
    setUploading(true);
    await storeUploadLogo(file);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleRemoveLogo = async () => {
    setShowRemoveLogoConfirm(false);
    setUploading(true);
    await removeLogo();
    setUploading(false);
  };

  if (!loaded) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="min-h-screen bg-white sm:bg-gray-100">
      <div className="max-w-2xl mx-auto px-4 py-4 sm:py-8 sm:px-6">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 cursor-pointer"
        >
          <ArrowLeft size={14} />
          {t('common.back')}
        </button>

        <div className="bg-white sm:rounded-xl sm:shadow-sm sm:border sm:border-gray-200 p-4 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('profile.title')}</h1>
          <div className="flex items-start gap-2 bg-blue-50 text-blue-700 text-sm rounded-lg px-3 py-2 mb-6">
            <Info size={16} className="shrink-0 mt-0.5" />
            <span>{t('profile.disclaimer')}</span>
          </div>

          {/* Logo */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 block mb-2">{t('profile.logo')}</label>
            {profile.logo ? (
              <div className="flex items-center gap-4">
                <img
                  src={profile.logo}
                  alt="Logo de empresa"
                  className="h-16 w-auto object-contain rounded border border-gray-200 bg-white p-1"
                />
                <button
                  onClick={() => setShowRemoveLogoConfirm(true)}
                  disabled={uploading}
                  className="text-sm text-red-500 hover:text-red-700 cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  {t('profile.removeLogo')}
                </button>
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
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <Upload size={16} />
                  {uploading ? t('profile.uploading') : t('profile.uploadLogo')}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="companyName"
              label={t('profile.companyName')}
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
          </div>

          <div className="mt-8 flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>

        <Modal open={showRemoveLogoConfirm} onClose={() => setShowRemoveLogoConfirm(false)}>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('profile.removeLogoTitle')}</h3>
          <p className="text-sm text-gray-600 mb-6">{t('profile.removeLogoMessage')}</p>
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowRemoveLogoConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={handleRemoveLogo}>
              {t('common.delete')}
            </Button>
          </div>
        </Modal>
      </div>
    </div>
  );
}
