interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const safeTotal = total > 0 ? total : 1;
  const progress = Math.min(100, Math.max(0, (current / safeTotal) * 100));

  return (
    <div className="fixed left-0 top-0 z-50 h-[3px] w-full bg-[var(--card-2)]">
      <div
        className="h-full rounded-pill bg-[#BFFF00] transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
