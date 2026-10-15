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
      <h1 className="font-sans text-3xl font-bold tracking-tight text-[var(--text-1)]">
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
          className="field-input"
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
        className="btn-primary mt-8 w-full"
      >
        {loading ? 'Saving...' : 'Continue'}
      </button>
    </div>
  );
}
