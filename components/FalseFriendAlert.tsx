"use client";

import { useState } from "react";
import { IconAlertTriangle } from "@tabler/icons-react";
import type { FalseFriendAlert as FalseFriendAlertData } from "@/types";

const FLAG_BY_LANGUAGE: Record<string, string> = {
  it: "🇮🇹",
  es: "🇪🇸",
  fr: "🇫🇷",
  ru: "🇷🇺",
  ca: "🏴",
  en: "🇬🇧"
};

function flagForLanguage(code: string): string {
  return FLAG_BY_LANGUAGE[code.toLowerCase()] ?? "🏳️";
}

function capitalizeLanguageCode(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

interface FalseFriendAlertProps {
  alert: FalseFriendAlertData;
  targetLanguageName: string;
  onDismiss: () => void;
}

export default function FalseFriendAlert({
  alert,
  targetLanguageName,
  onDismiss
}: FalseFriendAlertProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleGotIt() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/cards/false-friend-seen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_id: alert.id })
      });
    } catch (err) {
      console.error("[FalseFriendAlert] mark seen failed:", err);
    } finally {
      setSubmitting(false);
      onDismiss();
    }
  }

  const knownLanguageLabel = capitalizeLanguageCode(alert.known_language_code);
  const targetFlag = flagForLanguage(alert.language_code);
  const knownFlag = flagForLanguage(alert.known_language_code);

  return (
    <div className="card mx-page mt-6 border-warning/20 p-6 sm:mx-auto sm:max-w-lg">
      <div className="flex items-center justify-center gap-2 text-warning">
        <IconAlertTriangle size={16} stroke={2} aria-hidden />
        <p className="label-caps !text-warning">False friend</p>
      </div>

      <p className="mt-6 text-center font-serif text-4xl text-ink">{alert.word}</p>

      <p className="mx-auto mt-3 max-w-xs text-center text-base leading-relaxed text-ink-secondary">
        In {targetLanguageName}, &apos;{alert.word}&apos; means{" "}
        <span className="font-semibold text-ink">{alert.target_meaning}</span> — not{" "}
        {alert.known_language_meaning} (that&apos;s {knownLanguageLabel})
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <span className="rounded-pill border border-accent/30 bg-accent-soft px-4 py-2 text-sm font-medium text-ink">
          {targetFlag} {alert.target_meaning}
        </span>
        <span className="text-sm text-ink-tertiary" aria-hidden>
          ≠
        </span>
        <span className="rounded-pill border border-warning/30 bg-warning-soft px-4 py-2 text-sm font-medium text-ink">
          {knownFlag} {alert.known_language_meaning}
        </span>
      </div>

      <button
        type="button"
        onClick={() => void handleGotIt()}
        disabled={submitting}
        className="btn-primary mt-8 w-full"
      >
        Got it
      </button>
    </div>
  );
}
