"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";

interface PaywallGateProps {
  children: ReactNode;
  feature: string;
}

export function PaywallGate({ children, feature }: PaywallGateProps) {
  const { isPro, isLoading } = useSubscription();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleUpgrade = async () => {
    setIsRedirecting(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });

      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Could not start checkout.");
      }

      window.location.href = data.url;
    } catch (error) {
      console.error("Upgrade failed:", error);
      setIsRedirecting(false);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Checking subscription...</div>;
  }

  if (isPro) {
    return <>{children}</>;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium text-primary">Pro feature</p>
      <h3 className="mt-2 text-xl font-semibold text-foreground">{feature}</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Unlock this feature and the full premium toolkit.
      </p>

      <p className="mt-4 text-2xl font-bold text-foreground">
        €12<span className="ml-1 text-base font-normal text-muted-foreground">/month</span>
      </p>

      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        <li>- Unlimited AI-powered hints</li>
        <li>- Advanced spaced repetition analytics</li>
        <li>- Priority feature access</li>
      </ul>

      <Button
        onClick={handleUpgrade}
        disabled={isRedirecting}
        className="mt-6 h-11 w-full text-base font-semibold"
      >
        {isRedirecting ? "Redirecting..." : "Upgrade to Pro"}
      </Button>
    </div>
  );
}
