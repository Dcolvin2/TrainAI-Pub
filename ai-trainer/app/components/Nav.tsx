'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';

export default function Nav() {
  const { user, loading, signOut } = useAuth();

  if (loading) return null; // avoid flicker

  return (
    <nav className="w-full bg-card border-b border-border py-4 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image
            src="/trainai-logo.svg"
            alt="TrainAI Logo"
            width={120}
            height={48}
            className="logo"
          />
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-6">
          {user ? (
            <>
              <Link href="/dashboard" className="text-foreground hover:text-primary transition-colors font-medium">
                Dashboard
              </Link>
              <Link href="/new-workout" className="text-foreground hover:text-primary transition-colors font-medium">
                New Workout
              </Link>
              <Link href="/equipment" className="text-foreground hover:text-primary transition-colors font-medium">
                Equipment
              </Link>
              <Link href="/profile" className="text-foreground hover:text-primary transition-colors font-medium">
                Profile
              </Link>
              <button 
                onClick={signOut} 
                className="text-error hover:text-red-400 transition-colors font-medium"
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-foreground hover:text-primary transition-colors font-medium">
                Login
              </Link>
              <Link href="/signup">
                <button className="button-primary">
                  Sign Up
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
} 