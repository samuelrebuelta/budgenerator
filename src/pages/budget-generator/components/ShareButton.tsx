import { useState } from 'react';
import { Share } from 'lucide-react';
import { useActiveBudget } from '@/entities/budget';
import { useProfileStore } from '@/entities/profile';
import { shareBudget } from '@/shared/firebase';
import { Button } from '@/shared/ui';
import { t } from '@/shared/i18n';

export function ShareButton() {
  const budget = useActiveBudget();
  const profile = useProfileStore((s) => s.profile);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const handleShare = async () => {
    setSharing(true);
    try {
      let url = shareUrl;
      if (!url) {
        if (!budget) return;
        const token = await shareBudget(budget, profile);
        url = `${window.location.origin}/shared/${token}`;
        setShareUrl(url);
      }

      const shareTitle = profile.name
        ? t.share.shareTitle(profile.name)
        : t.header.title;

      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
    } finally {
      setSharing(false);
    }
  };

  return (
    <Button variant="secondary" onClick={handleShare} disabled={sharing} title={t.share.button}>
      <Share size={16} />
      {t.share.button}
    </Button>
  );
}
