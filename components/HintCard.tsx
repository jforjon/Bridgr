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
          "fixed inset-0 bg-foreground/40 transition-opacity duration-300 z-40",
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
        <div className="bg-background shadow-xl">
          {/* Drag handle indicator */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
          </div>

          <div className="px-6 pb-8 pt-4">
            {/* Header with bookmark */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h2
                  id="hint-word"
                  className="text-3xl font-bold text-foreground tracking-tight"
                >
                  {word}
                </h2>
                <p className="text-muted-foreground text-lg mt-1">
                  {translation}
                </p>
              </div>

              <button
                onClick={handleSave}
                className="p-2 -mr-2 -mt-1 transition-colors hover:bg-muted rounded-lg"
                aria-label={isSaved ? "Remove bookmark" : "Save connection"}
              >
                <span
                  className={cn(
                    "text-xs font-semibold transition-colors",
                    isSaved ? "text-amber-600" : "text-muted-foreground"
                  )}
                >
                  {isSaved ? "Saved" : "Save"}
                </span>
              </button>
            </div>

            {/* Hint block with amber background */}
            <div className="bg-amber-50 border border-amber-200/60 p-4 mb-6">
              <div className="flex gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <Lightbulb className="size-5 text-amber-600" />
                </div>
                <p className="text-amber-900 text-sm leading-relaxed">
                  {hint}
                </p>
              </div>
            </div>

            {/* Got it button */}
            <Button
              onClick={onClose}
              className="w-full h-12 text-base font-medium"
            >
              Got it
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
