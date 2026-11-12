import { toUserMessage } from '@/shared/lib';
import { TEAM_COPY } from './copy';

export function teamErrorMessage(error: unknown, fallback: string = TEAM_COPY.saveError): string {
  return toUserMessage(error, {
    fallback,
    permissionDenied: TEAM_COPY.permissionDenied,
  });
}
