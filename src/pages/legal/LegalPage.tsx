import { Link, Navigate, useParams } from 'react-router-dom';
import { Brand } from '@/shared/ui/Brand';
import { LegalLinks } from '@/shared/ui/LegalLinks';
import { LEGAL_DOCUMENTS, isLegalDocumentId } from './legalContent';

export function LegalPage() {
  const { document: documentId } = useParams();
  if (!isLegalDocumentId(documentId)) return <Navigate to="/legal/privacidad" replace />;
  const legal = LEGAL_DOCUMENTS[documentId];
  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-gray-200 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link to="/login" aria-label="Volver a BudGenerator">
            <Brand />
          </Link>
          <LegalLinks className="justify-end" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">{legal.title}</h1>
        {legal.sections.map((section) => (
          <section key={section.heading} className="mb-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mb-2 text-sm leading-6 text-gray-700">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}
