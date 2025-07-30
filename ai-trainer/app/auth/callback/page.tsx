'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');

  useEffect(() => {
    // Supabase delivers tokens either as query params or hash fragment
    let access = searchParams?.get('access_token');
    let refresh = searchParams?.get('refresh_token');
    let type = searchParams?.get('type');

    if (!access) {
      const hash = typeof window !== 'undefined' && window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
      const params = new URLSearchParams(hash);
      access = params.get('access_token');
      refresh = params.get('refresh_token');
      type = params.get('type');
    }

    if (type === 'magiclink' && access && refresh) {
      supabase.auth
        .setSession({ access_token: access, refresh_token: refresh })
        .then(({ error }: { error: any }) => {
          if (error) {
            console.error(error);
            setStatus('error');
          } else {
            router.replace('/new-workout');
          }
        });
    } else {
      setStatus('error');
    }
  }, [router, searchParams]);

  if (status === 'error') {
    return (
      <div className="p-4 max-w-sm mx-auto text-center text-red-600">
        Invalid or expired magic link.
      </div>
    );
  }

  return (
    <div className="p-4 max-w-sm mx-auto text-center">
      Signing you in…
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="p-4 max-w-sm mx-auto text-center">
        Loading...
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
} 