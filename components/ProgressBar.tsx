interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const safeTotal = total > 0 ? total : 1;
  const progress = Math.min(100, Math.max(0, (current / safeTotal) * 100));

  return (
    <div className="fixed left-0 top-0 z-50 h-[3px] w-full bg-[var(--surface-2)]">
      <div
        className="progress-bar__fill duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
