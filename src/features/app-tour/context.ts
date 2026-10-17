import { createContext, useContext } from 'react';

interface AppTourContextValue {
  startTour: () => void;
}

export const AppTourContext = createContext<AppTourContextValue | null>(null);

export function useAppTour() {
  return useContext(AppTourContext)?.startTour ?? (() => {});
}
