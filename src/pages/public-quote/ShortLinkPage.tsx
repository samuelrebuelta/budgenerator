import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  resolveEstimatorShortLink,
  SHORT_LINK_SLUG_PATTERN,
  type ShortLinkResolution,
} from '@/entities/quote-estimator';
import { LoadingScreen } from '@/shared/ui/LoadingScreen';
import { EstimatorUnavailable } from './EstimatorUnavailable';
import { PublicEstimator } from './QuoteEstimatorPage';

/** `/p/{slug}`: the company's stable short link to its current public form. */
export function ShortLinkPage() {
  const { slug = '' } = useParams();
  const valid = SHORT_LINK_SLUG_PATTERN.test(slug);
  const [result, setResult] = useState<ShortLinkResolution | 'failed' | null>(null);

  useEffect(() => {
    if (!valid) return;
    let active = true;
    resolveEstimatorShortLink(slug)
      .then((resolution) => {
        if (active) setResult(resolution);
      })
      .catch(() => {
        if (active) setResult('failed');
      });
    return () => {
      active = false;
    };
  }, [slug, valid]);

  if (!valid || result === 'failed') return <EstimatorUnavailable />;
  if (!result) return <LoadingScreen />;
  if ('token' in result) return <PublicEstimator key={result.token} token={result.token} />;
  return <EstimatorUnavailable contact={result.company} />;
}
