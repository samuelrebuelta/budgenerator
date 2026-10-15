export function Brand({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className={`brand ${light ? 'brand-light' : ''}`}>
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path
          d="M8 40V25C8 15.61 15.61 8 25 8H37V16H25C20.03 16 16 20.03 16 25V40H8Z"
          fill="currentColor"
        />
        <path d="M24 40V26C24 23.79 25.79 22 28 22H40V30H32V40H24Z" fill="currentColor" />
        <path d="M38 6H46V14H38V6Z" fill="#C65D3B" />
      </svg>
      {!compact && (
        <span className="brand-word">
          budgenerator<span className="brand-dot">.</span>
        </span>
      )}
    </span>
  );
}
