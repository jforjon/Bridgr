import type { ReactNode } from "react";

export interface BridgrPageLoadingProps {
  /** Main message below the pulsing circle (default: lesson copy). */
  title?: string;
  /**
   * Muted line under the title. Omit for default "Loading words and hints".
   * Pass `null` to hide the subtitle row entirely.
   */
  subtitle?: string | null;
  /** Optional content below the subtitle (e.g. rotating status lines). */
  children?: ReactNode;
  /** Optional footer (e.g. BottomNav). */
  bottomSlot?: ReactNode;
  className?: string;
}

/**
 * Full-screen loading shell: Bridgr header + pulsing circle + title + subtitle.
 * Use while client or server data loads so users never see a blank white screen.
 */
export default function BridgrPageLoading({
  title = "Preparing your lesson...",
  subtitle,
  children,
  bottomSlot,
  className = ""
}: BridgrPageLoadingProps) {
  const resolvedSubtitle = subtitle === undefined ? "Loading words and hints" : subtitle;

  return (
    <main className={`flex min-h-screen flex-col bg-teal-900 pb-24 ${className}`}>
      <p className="px-6 pt-8 font-sans font-extrabold text-2xl text-lime-300">Bridgr</p>
      <div className="flex flex-1 flex-col items-center px-6">
        <div
          className="mx-auto mt-32 h-16 w-16 shrink-0 rounded-full border-2 border-teal-400 bg-teal-800 animate-pulse"
          aria-hidden
        />
        <p className="mt-8 text-center font-sans font-extrabold text-xl text-white">{title}</p>
        {resolvedSubtitle !== null && resolvedSubtitle !== "" ? (
          <p className="mt-2 text-center text-sm text-teal-200">{resolvedSubtitle}</p>
        ) : null}
        {children}
      </div>
      {bottomSlot}
    </main>
  );
}
