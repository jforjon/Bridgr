"use client";

import type { CognateNote } from "@/lib/session-cognate";

interface CognateNoteLineProps {
  note: CognateNote;
}

export default function CognateNoteLine({ note }: CognateNoteLineProps) {
  const displayLine = note.line.replace(/\s*💡\s*$/, "").trim();

  return (
    <p className="mt-4 text-center text-sm italic text-muted">{displayLine}</p>
  );
}
