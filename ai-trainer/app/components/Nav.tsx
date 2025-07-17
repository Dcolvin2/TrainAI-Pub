'use client';

import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="w-full bg-gray-100 dark:bg-gray-800 py-3 mb-6 shadow">
      <div className="max-w-4xl mx-auto px-4 flex gap-4 text-sm font-medium">
        <Link href="/login" className="hover:underline">Login</Link>
        <Link href="/signup" className="hover:underline">Sign Up</Link>
        <Link href="/new-workout" className="hover:underline">New Workout</Link>
      </div>
    </nav>
  );
} 