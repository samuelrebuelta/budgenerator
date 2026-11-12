import { Link } from 'react-router-dom';

const LINKS: { id: string; label: string }[] = [
  { id: 'privacidad', label: 'Privacidad' },
  { id: 'condiciones', label: 'Condiciones' },
  { id: 'aviso-legal', label: 'Aviso legal' },
  { id: 'cookies', label: 'Cookies' },
];

export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <nav aria-label="Textos legales" className={`flex flex-wrap gap-x-4 gap-y-1 ${className}`}>
      {LINKS.map((link) => (
        <Link
          key={link.id}
          to={`/legal/${link.id}`}
          className="text-xs text-gray-500 underline hover:text-gray-700"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
