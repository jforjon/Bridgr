"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

type BackHandler = (() => void) | null;

type OnboardingBackContextValue = {
  backHandler: BackHandler;
  setBackHandler: (handler: BackHandler) => void;
};

const OnboardingBackContext = createContext<OnboardingBackContextValue | null>(null);

export function OnboardingBackProvider({ children }: { children: ReactNode }) {
  const [backHandler, setBackHandlerState] = useState<BackHandler>(null);

  const setBackHandler = useCallback((handler: BackHandler) => {
    setBackHandlerState(() => handler);
  }, []);

  const value = useMemo(
    () => ({
      backHandler,
      setBackHandler
    }),
    [backHandler, setBackHandler]
  );

  return <OnboardingBackContext.Provider value={value}>{children}</OnboardingBackContext.Provider>;
}

export function useOnboardingBackHandler() {
  const context = useContext(OnboardingBackContext);
  if (!context) {
    throw new Error("useOnboardingBackHandler must be used within OnboardingBackProvider");
  }
  return context.backHandler;
}

export function useRegisterOnboardingBack(handler: BackHandler) {
  const context = useContext(OnboardingBackContext);
  if (!context) {
    throw new Error("useRegisterOnboardingBack must be used within OnboardingBackProvider");
  }

  const { setBackHandler } = context;

  useEffect(() => {
    setBackHandler(handler);
    return () => setBackHandler(null);
  }, [handler, setBackHandler]);
}
