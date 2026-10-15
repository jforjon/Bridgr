"use client";

interface UnderstandDeeperSheetProps {
  open: boolean;
  title: string;
  body: string;
  onClose: () => void;
}

export default function UnderstandDeeperSheet({
  open,
  title,
  body,
  onClose
}: UnderstandDeeperSheetProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-[var(--scrim)]"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="sheet absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="understand-deeper-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[var(--surface-2)]" aria-hidden />
        <p
          id="understand-deeper-title"
          className="text-xs font-bold uppercase tracking-wider text-muted"
        >
          Understand deeper
        </p>
        <p className="mt-2 font-serif text-2xl text-[var(--text-1)]">{title}</p>
        <p className="mt-4 text-sm leading-relaxed text-[var(--text-1)]">{body}</p>
        <button type="button" className="btn-primary mt-8 w-full" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
