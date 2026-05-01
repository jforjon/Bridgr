"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface UseSubscriptionResult {
  isPro: boolean;
  isLoading: boolean;
}

export function useSubscription(): UseSubscriptionResult {
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    async function loadSubscription() {
      setIsLoading(true);
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        if (isMounted) {
          setIsPro(false);
          setIsLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("subscription_status")
        .eq("id", user.id)
        .maybeSingle();

      if (isMounted) {
        setIsPro(data?.subscription_status === "pro");
        setIsLoading(false);
      }
    }

    void loadSubscription();

    return () => {
      isMounted = false;
    };
  }, []);

  return { isPro, isLoading };
}
