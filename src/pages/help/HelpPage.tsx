import { ChevronDown, ArrowUpRight, Play } from 'lucide-react';
import { Button, PageLayout, PageHeader, PageLink } from '@/shared/ui';
import { useAppTour } from '@/features/app-tour/context';
import { helpTopics } from './helpContent';

export function HelpPage() {
  const startTour = useAppTour();
  return (
    <PageLayout>
      <PageHeader
        title="Ayuda y guía"
        description="Encuentra los pasos para preparar tus presupuestos y resolver las dudas habituales."
        backTo="/projects"
        backLabel="Volver a proyectos"
        actions={
          <Button variant="secondary" onClick={startTour}>
            <Play size={16} aria-hidden="true" /> Ver guía interactiva
          </Button>
        }
      />
      <div className="grid grid-cols-1 items-start gap-7 shell:grid-cols-[200px_minmax(0,1fr)] shell:gap-12">
        <nav
          className="flex flex-row flex-wrap gap-1.5 shell:sticky shell:top-6 shell:flex-col shell:gap-1"
          aria-label="Temas de ayuda"
        >
          {helpTopics.map((topic) => (
            <a
              key={topic.id}
              href={`#${topic.id}`}
              className="focus-ring flex min-h-11 items-center rounded-lg bg-tint-strong px-3 py-2 text-xs text-ink-soft no-underline shell:bg-transparent shell:py-2.5 shell:text-[13px] pointer-fine:hover:bg-tint"
            >
              {topic.title}
            </a>
          ))}
        </nav>
        <div>
          {helpTopics.map((topic) => (
            <section
              key={topic.id}
              aria-labelledby={`${topic.id}-heading`}
              id={topic.id}
              className="mb-10 scroll-mt-6"
            >
              <h2
                id={`${topic.id}-heading`}
                className="mb-1.5 text-xl font-bold tracking-[-0.02em] text-ink"
              >
                {topic.title}
              </h2>
              <p className="mb-4 text-[13px] leading-[1.8] text-ink-muted">{topic.description}</p>
              {topic.questions.map((item) => (
                <details key={item.question} className="group border-b border-line-strong">
                  <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <ChevronDown
                      size={18}
                      aria-hidden="true"
                      className="flex-none transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    />
                  </summary>
                  <div className="max-w-[70ch] px-2 pb-5 text-[13px] leading-[1.9]">
                    <ol className="mb-3.5 list-decimal space-y-2 pl-5">
                      {item.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    <PageLink
                      to={item.link.to}
                      className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary underline underline-offset-4"
                    >
                      {item.link.label}
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </PageLink>
                  </div>
                </details>
              ))}
            </section>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
