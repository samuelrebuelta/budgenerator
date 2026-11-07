import { createContext, type ReactNode } from 'react';

export interface PageHeaderContextValue {
  accessory: ReactNode;
  mobileBackTarget: HTMLElement | null;
  workspaceHeaderActionTarget: HTMLElement | null;
}

export const PageHeaderAccessoryContext = createContext<PageHeaderContextValue>({
  accessory: null,
  mobileBackTarget: null,
  workspaceHeaderActionTarget: null,
});
