'use client'
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export function Layout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      <nav className="bg-[#1E293B] p-4 flex justify-between items-center">
        <div className="flex space-x-4">
          <Link href="/todays-workout" className="hover:underline hover:text-green-400 transition-colors">
            Workout
          </Link>
          <Link href="/workout/builder" className="hover:underline hover:text-green-400 transition-colors">
            New Workout
          </Link>
          <Link href="/equipment" className="hover:underline hover:text-green-400 transition-colors">
            Equipment
          </Link>
          <Link href="/profile" className="hover:underline hover:text-green-400 transition-colors">
            Profile
          </Link>
        </div>
        <button 
          onClick={signOut} 
          className="text-red-500 hover:text-red-400 transition-colors"
        >
          Log Out
        </button>
      </nav>
      <main>{children}</main>
    </div>
  );
} 