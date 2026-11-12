import { toUserMessage } from '@/shared/lib';
import { TEAM_COPY } from './copy';

export function teamErrorMessage(error: unknown): string {
  return toUserMessage(error, {
    fallback: TEAM_COPY.saveError,
    permissionDenied: TEAM_COPY.permissionDenied,
  });
}
