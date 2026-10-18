import { Link } from 'react-router-dom';
import { ChevronDown, ArrowUpRight, Play } from 'lucide-react';
import { Button, PageLayout, PageHeader } from '@/shared/ui';
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
            <Play size={16} /> Ver guía interactiva
          </Button>
        }
      />
      <div className="help-layout">
        <nav className="help-topics" aria-label="Temas de ayuda">
          {helpTopics.map((topic) => (
            <a key={topic.id} href={`#${topic.id}`}>
              {topic.title}
            </a>
          ))}
        </nav>
        <div className="help-content">
          {helpTopics.map((topic) => (
            <section
              key={topic.id}
              aria-labelledby={`${topic.id}-heading`}
              id={topic.id}
              className="help-topic"
            >
              <h2 id={`${topic.id}-heading`}>{topic.title}</h2>
              <p>{topic.description}</p>
              {topic.questions.map((item) => (
                <details key={item.question} className="help-question">
                  <summary>
                    {item.question}
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <div>
                    <ol>
                      {item.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    <Link to={item.link.to}>
                      {item.link.label}
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
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
