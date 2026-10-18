import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { Button } from '@/shared/ui';
import { AppTourContext } from './context';
import { isWelcomeTourPending, markWelcomeTourComplete } from './model';

const steps = [
  {
    path: '/projects',
    target: '[data-page-header]',
    title: 'El seguimiento empieza en Proyectos',
    description:
      'Al aceptar un presupuesto, conviértelo en proyecto para seguir conceptos, registrar imprevistos y consultar la evolución por fecha.',
  },
  {
    path: '/budgets',
    target: '[data-tour="budget-create"]',
    title: 'Tus presupuestos',
    description:
      'Aquí organizas cada obra. Empieza desde cero o reutiliza una plantilla para preparar el documento de tu cliente.',
  },
  {
    path: '/catalog',
    target: '[data-tour="category-import"]',
    title: 'El catálogo de tu empresa',
    description:
      'Guarda tus partidas, conceptos y tarifas. Puedes importar una categoría como punto de partida y adaptar los precios.',
  },
  {
    path: '/templates',
    target: '[data-tour="template-create"]',
    title: 'Lo que repites, guárdalo',
    description:
      'Crea plantillas con las partidas habituales y úsalas como base de nuevos presupuestos.',
  },
  {
    path: '/profile',
    target: '[data-tour="company-profile"]',
    title: 'Presenta tu empresa',
    description:
      'Añade el nombre, los datos y el logo que quieres mostrar en los presupuestos que compartes.',
  },
] as const;

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function RenovatorMascot() {
  return (
    <svg className="app-tour-mascot" viewBox="0 0 64 72" aria-hidden="true">
      <circle cx="32" cy="36" r="32" fill="#dcece4" />
      <path d="M23 50h8l-2 13h-7l1-13Zm10 0h8l4 13h-7l-5-13Z" fill="#183e3b" />
      <path d="M21 39h23l4 14H18l3-14Z" fill="#c65d3b" />
      <path d="m28 40 5 6 5-6" fill="none" stroke="#fffdf8" strokeWidth="2" />
      <path d="M25 23c0-7 4-11 9-11s9 4 9 11v8c0 6-4 10-9 10s-9-4-9-10v-8Z" fill="#efc8a5" />
      <path d="M22 23c0-9 5-15 12-15s12 6 12 15v2H22v-2Z" fill="#d4a33b" />
      <path d="M20 23h28c0 3-2 5-5 5H25c-3 0-5-2-5-5Z" fill="#b78026" />
      <circle cx="30" cy="29" r="1.2" fill="#183e3b" />
      <circle cx="38" cy="29" r="1.2" fill="#183e3b" />
      <path
        d="M31 34c1 1 3 1 4 0"
        fill="none"
        stroke="#9a513b"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <path d="m20 42-6 9 5 3 7-9m18-3 6 8-4 4-8-8" fill="#c65d3b" />
      <path d="m14 49-3 3 6 4 3-3" fill="#efc8a5" />
      <path d="m46 49 4 4-3 4-5-4" fill="#efc8a5" />
      <rect
        x="43"
        y="49"
        width="10"
        height="13"
        rx="1.5"
        fill="#fffdf8"
        stroke="#24564c"
        strokeWidth="1.5"
      />
      <path d="M46 53h4m-4 3h4" stroke="#24564c" strokeLinecap="round" strokeWidth="1" />
    </svg>
  );
}

export function AppTourProvider({ userId, children }: { userId?: string; children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const autoStarted = useRef(false);
  const previousStepPath = useRef<string | null>(null);
  const stepIndex = steps.findIndex((step) => step.path === location.pathname);
  const currentStep = stepIndex >= 0 ? steps[stepIndex] : null;

  useEffect(() => {
    if (!userId || autoStarted.current || !isWelcomeTourPending(userId)) return;
    autoStarted.current = true;
    previousStepPath.current = null;
    setOpen(true);
    if (location.pathname !== '/projects') navigate('/projects', { replace: true });
  }, [location.pathname, navigate, userId]);

  const closeTour = useCallback(() => {
    if (userId) markWelcomeTourComplete(userId);
    previousStepPath.current = null;
    setOpen(false);
    setSpotlight(null);
  }, [userId]);

  useEffect(() => {
    if (!currentStep) {
      if (open && previousStepPath.current && previousStepPath.current !== location.pathname)
        closeTour();
      return;
    }
    previousStepPath.current = currentStep.path;
  }, [closeTour, currentStep, location.pathname, open]);

  const startTour = useCallback(() => {
    previousStepPath.current = null;
    setSpotlight(null);
    setOpen(true);
    if (location.pathname !== '/projects') navigate('/projects');
  }, [location.pathname, navigate]);

  const goToStep = (index: number) => {
    const nextStep = steps[index];
    if (!nextStep) return;
    previousStepPath.current = nextStep.path;
    navigate(nextStep.path);
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeTour();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeTour, open]);

  useLayoutEffect(() => {
    if (!open || !currentStep) return;
    let frame = 0;
    let updateFrame = 0;
    const updateSpotlight = () => {
      const target = document.querySelector<HTMLElement>(currentStep.target);
      if (!target) {
        setSpotlight(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      const next = {
        top: Math.max(4, rect.top - 5),
        left: Math.max(4, rect.left - 5),
        width: Math.min(rect.width + 10, window.innerWidth - Math.max(4, rect.left - 5) - 4),
        height: Math.min(rect.height + 10, window.innerHeight - Math.max(4, rect.top - 5) - 4),
      };
      setSpotlight((previous) =>
        previous &&
        previous.top === next.top &&
        previous.left === next.left &&
        previous.width === next.width &&
        previous.height === next.height
          ? previous
          : next,
      );
    };
    frame = requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(currentStep.target);
      if (target) {
        const rect = target.getBoundingClientRect();
        if (rect.top < 72 || rect.bottom > window.innerHeight - 96) {
          const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          target.scrollIntoView({
            block: 'nearest',
            behavior: reducedMotion ? 'instant' : 'smooth',
          });
        }
      }
      updateFrame = requestAnimationFrame(updateSpotlight);
    });
    const observer = new MutationObserver(updateSpotlight);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', updateSpotlight);
    window.addEventListener('scroll', updateSpotlight, true);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(updateFrame);
      observer.disconnect();
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight, true);
    };
  }, [currentStep, location.pathname, open]);

  const nextStep = stepIndex >= 0 ? steps[stepIndex + 1] : undefined;
  const previousStep = stepIndex > 0 ? steps[stepIndex - 1] : undefined;

  return (
    <AppTourContext.Provider value={{ startTour }}>
      {children}
      {open && currentStep && (
        <div className="app-tour-layer no-print">
          {spotlight ? (
            <div
              className="app-tour-spotlight"
              aria-hidden="true"
              style={{
                top: spotlight.top,
                left: spotlight.left,
                width: spotlight.width,
                height: spotlight.height,
              }}
            />
          ) : (
            <div className="app-tour-scrim" aria-hidden="true" />
          )}
          <section
            role="dialog"
            aria-modal="false"
            aria-label="Guía interactiva de Budgenerator"
            data-app-tour
            data-step={stepIndex + 1}
            className="app-tour-card"
          >
            <div className="app-tour-heading">
              <RenovatorMascot />
              <div className="min-w-0 flex-1">
                <p className="app-tour-progress">
                  Paso {stepIndex + 1} de {steps.length}
                </p>
                <h2 className="app-tour-title">{currentStep.title}</h2>
              </div>
              <button
                type="button"
                className="app-tour-close"
                aria-label="Cerrar guía"
                onClick={closeTour}
              >
                <X size={18} />
              </button>
            </div>
            <p className="app-tour-description" aria-live="polite">
              {currentStep.description}
            </p>
            <div className="app-tour-actions">
              <Button variant="ghost" onClick={closeTour}>
                Omitir guía
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  aria-label="Paso anterior"
                  disabled={!previousStep}
                  onClick={() => previousStep && goToStep(stepIndex - 1)}
                >
                  <ArrowLeft size={16} />
                </Button>
                <Button
                  onClick={() => {
                    if (nextStep) goToStep(stepIndex + 1);
                    else {
                      closeTour();
                      navigate('/budgets');
                    }
                  }}
                >
                  {nextStep ? 'Siguiente' : 'Ir a presupuestos'}
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </AppTourContext.Provider>
  );
}
