import { useState } from 'react';
export function CompanyAvatar({ name, logo }: { name: string; logo?: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return (
    <span className="company-avatar" aria-hidden="true">
      {logo && failedSource !== logo ? (
        <img src={logo} alt="" onError={() => setFailedSource(logo)} />
      ) : (
        (name.trim()[0]?.toLocaleUpperCase('es') ?? 'B')
      )}
    </span>
  );
}
