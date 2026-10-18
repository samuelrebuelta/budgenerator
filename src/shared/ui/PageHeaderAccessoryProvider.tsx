import type { ReactNode } from 'react';
import { PageHeaderAccessoryContext } from './PageHeaderAccessoryContext';

export function PageHeaderAccessoryProvider({
  children,
  accessory,
}: {
  children: ReactNode;
  accessory?: ReactNode;
}) {
  return (
    <PageHeaderAccessoryContext.Provider value={accessory ?? null}>
      {children}
    </PageHeaderAccessoryContext.Provider>
  );
}
