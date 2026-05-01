interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const safeTotal = total > 0 ? total : 1;
  const progress = Math.min(100, Math.max(0, (current / safeTotal) * 100));

  return (
    <div className="fixed left-0 top-0 z-50 h-1 w-full bg-slate-100">
      <div
        className="h-full bg-primary-600 transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
