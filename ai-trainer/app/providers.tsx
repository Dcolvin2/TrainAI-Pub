'use client'

import { AuthProvider } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useEffect } from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  // Add authentication persistence code
  useEffect(() => {
    // Configure Supabase session persistence
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Only clear on explicit sign out, not on refresh
        localStorage.removeItem('supabase.auth.token');
      } else if (session) {
        // Persist session
        localStorage.setItem('supabase.auth.token', JSON.stringify(session));
      }
    });

    // Restore session on app load
    const restoreSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('Session restored on app load');
      }
    };
    
    restoreSession();
  }, []);

  // Also add this to prevent refresh issues
  const handleRefresh = () => {
    // Don't clear auth state on refresh
    window.location.reload();
  };

  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
} 