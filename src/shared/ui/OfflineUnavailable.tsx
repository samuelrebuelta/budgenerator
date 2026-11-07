import { WifiOff } from 'lucide-react';

export function OfflineUnavailable() {
  return (
    <section
      className="rounded-2xl border border-[#d9ded4] bg-[#f4f5ee] px-6 py-10 text-center sm:px-10"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#52625a] shadow-sm">
        <WifiOff size={21} aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-[#1f2b26]">
        Contenido no disponible sin conexión
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#56635b]">
        Esta pantalla aún no tiene datos cargados en esta sesión. Conéctate a internet para abrirla.
      </p>
    </section>
  );
}
