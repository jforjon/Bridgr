'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function OnboardingStepOnePage() {
  const nameRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleContinue() {
    const name = nameRef.current?.value ?? '';
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser();
      if (authError || !user) {
        setError('Session expired — please log in again');
        setLoading(false);
        return;
      }
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ name: name.trim() })
        .eq('id', user.id);
      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }
      window.location.href = '/onboarding/2';
    } catch (e) {
      console.error('caught error:', e);
      setError('Something went wrong — please try again');
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <h1 className="font-sans text-3xl font-black tracking-tight text-[var(--text-primary)]">
        What should we call you?
      </h1>
      <div className="mt-6">
        <input
          ref={nameRef}
          type="text"
          defaultValue=""
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleContinue();
            }
          }}
          placeholder="Your name"
          className="h-12 w-full rounded-pill border-none bg-[var(--card-2)] px-4 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:outline-none"
          autoComplete="name"
        />
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          console.log('BUTTON CLICKED');
          void handleContinue();
        }}
        disabled={loading}
        className="mt-8 w-full rounded-pill bg-[#BFFF00] py-4 text-base font-extrabold text-[#2A3800] hover:bg-[#A8E000] disabled:cursor-not-allowed disabled:opacity-30"
      >
        {loading ? 'Saving...' : 'Continue'}
      </button>
    </div>
  );
}
