export function ProjectProgressBar({ percent, label }: { percent: number; label: string }) {
  const safePercent = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safePercent}
      className="h-2 overflow-hidden rounded-full bg-[#e7e7db]"
    >
      <div
        aria-hidden="true"
        className="h-full rounded-full bg-[#183e3b] transition-[width] duration-200"
        style={{ width: `${safePercent}%` }}
      />
    </div>
  );
}
