import type { ReactNode } from 'react';
import { PageHeaderAccessoryContext } from './PageHeaderAccessoryContext';

export function PageHeaderAccessoryProvider({
  children,
  accessory,
  mobileBackTarget = null,
  workspaceHeaderActionTarget = null,
}: {
  children: ReactNode;
  accessory?: ReactNode;
  mobileBackTarget?: HTMLElement | null;
  workspaceHeaderActionTarget?: HTMLElement | null;
}) {
  return (
    <PageHeaderAccessoryContext.Provider
      value={{ accessory: accessory ?? null, mobileBackTarget, workspaceHeaderActionTarget }}
    >
      {children}
    </PageHeaderAccessoryContext.Provider>
  );
}
