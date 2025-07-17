'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Guard from '@/app/components/Guard';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  return (
    <Guard>
      <div className="p-4">
        <h1 className="text-2xl font-bold">Welcome, {user?.email || '...'}</h1>
        <p className="mb-4">This is your dashboard.</p>
        <button
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
          onClick={async () => {
            await signOut();
            router.push('/login');
          }}
        >
          Sign Out
        </button>
      </div>
    </Guard>
  );
} 