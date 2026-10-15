"use client"

import { useState } from "react"
import { Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "../lib/utils"

interface LanguageHintCardProps {
  word: string
  translation: string
  hint: string
  isOpen: boolean
  onClose: () => void
  onSave?: () => void
}

export function LanguageHintCard({
  word,
  translation,
  hint,
  isOpen,
  onClose,
  onSave,
}: LanguageHintCardProps) {
  const [isSaved, setIsSaved] = useState(false)

  const handleSave = () => {
    setIsSaved(!isSaved)
    onSave?.()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "scrim fixed inset-0 z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hint-word"
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="sheet">
          {/* Drag handle indicator */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="sheet-grabber" />
          </div>

          <div className="px-6 pb-8 pt-4">
            {/* Header with bookmark */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                {/* The word being learned — display face, as the system reserves
                    Bricolage for the language itself. */}
                <h2 id="hint-word" className="type-display text-title-2 text-ink">
                  {word}
                </h2>
                <p className="body-lg mt-1 text-ink-secondary">{translation}</p>
              </div>

              <button
                onClick={handleSave}
                className={cn("btn-quiet", isSaved && "text-accent")}
                aria-label={isSaved ? "Remove bookmark" : "Save connection"}
              >
                {isSaved ? "Saved" : "Save"}
              </button>
            </div>

            <div className="alert alert--warning mb-6">
              <Lightbulb className="size-5 shrink-0 text-warning" />
              <p className="alert__body">{hint}</p>
            </div>

            <Button onClick={onClose} fullWidth>
              Got it
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
