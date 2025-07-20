'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function Nav() {
  const { user, loading, signOut } = useAuth();

  if (loading) return null; // avoid flicker

  return (
    <nav className="w-full bg-gray-100 dark:bg-gray-800 py-3 mb-6 shadow">
      <div className="max-w-4xl mx-auto px-4 flex gap-4 text-sm font-medium items-center">
        {user ? (
          <>
            <Link href="/profile" className="hover:underline">
              Profile
            </Link>
            <Link href="/equipment" className="hover:underline">
              Equipment
            </Link>
            <Link href="/new-workout" className="hover:underline">
              New Workout
            </Link>
            <button onClick={signOut} className="ml-auto text-red-600 hover:underline">
              Log&nbsp;Out
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="hover:underline">
              Login
            </Link>
            <Link href="/signup" className="hover:underline">
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
} 