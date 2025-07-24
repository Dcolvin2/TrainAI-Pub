'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login attempt with:', { email, password: password ? '[HIDDEN]' : 'empty' });
    setLoading(true);
    setError('');
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      console.log('Supabase response:', { data, error });
      
      if (error) {
        console.error('Login error:', error);
        setError(error.message);
      } else {
        console.log('Login successful:', data);
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <img
            src="/Updatedlogo.png"
            alt="TrainAI Logo"
            className="w-24 sm:w-32 h-auto mx-auto mb-6"
          />
        </div>

        {/* Login Container */}
        <div className="bg-[#1E293B] rounded-2xl shadow-lg p-8">
          <h1 className="text-xl font-semibold text-center mb-6 text-[#E2E8F0]">
            Welcome Back
          </h1>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#0F172A] border border-[#334155] text-white px-4 py-3 rounded-lg w-full placeholder:text-muted focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20 transition-all duration-200"
                required
              />
            </div>
            
            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#0F172A] border border-[#334155] text-white px-4 py-3 rounded-lg w-full placeholder:text-muted focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20 transition-all duration-200"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#22C55E] hover:bg-[#16a34a] focus:bg-[#16a34a] text-white font-semibold rounded-xl py-3 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          {/* Links */}
          <div className="mt-6 text-center space-y-3">
            <Link href="/signup" className="text-[#22C55E] hover:text-[#16a34a] transition-colors block text-sm">
              Don&apos;t have an account? Sign up
            </Link>
            <Link href="/forgot-password" className="text-muted hover:text-[#E2E8F0] transition-colors block text-sm">
              Forgot your password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 