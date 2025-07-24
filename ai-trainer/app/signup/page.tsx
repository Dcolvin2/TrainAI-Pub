'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    setErrorMsg('');
    setLoading(true);
    const {
      data: { user },
      error: signUpError,
    } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      if (signUpError.message?.toLowerCase().includes('already') || signUpError.status === 400) {
        setErrorMsg('An account with this email already exists. Forgot your password?');
      } else {
        setErrorMsg(signUpError.message);
      }
      setLoading(false);
      return;
    }

    if (!user) {
      setErrorMsg('User object not returned.');
      setLoading(false);
      return;
    }

    // Set first_name in user metadata
    const { error: metaError } = await supabase.auth.updateUser({ data: { first_name: firstName } });

    if (metaError) {
      setErrorMsg(metaError.message);
      setLoading(false);
      return;
    }

    // profiles.id is a FK to auth.users.id, so use id column directly
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ id: user.id, first_name: firstName });

    if (insertError) {
      setErrorMsg(insertError.message);
      setLoading(false);
      return;
    }

    // Success → go to dashboard
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <img
            src="/Updatedlogo.png"
            alt="TrainAI Logo"
            className="w-20 sm:w-28 h-auto mx-auto"
          />
        </div>

        {/* Signup Container */}
        <div className="bg-[#1E293B] rounded-2xl shadow-lg p-8">
          <h1 className="text-xl font-semibold text-center mb-6 text-[#E2E8F0]">
            Join TrainAI
          </h1>
          
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
              <p>{errorMsg}</p>
              {errorMsg.toLowerCase().includes('already') && (
                <Link href="/forgot-password" className="text-[#22C55E] hover:text-[#16a34a] transition-colors text-sm underline">
                  Reset your password
                </Link>
              )}
            </div>
          )}
          
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setErrorMsg(''); }}
                className="bg-[#0F172A] border border-[#334155] text-white px-4 py-3 rounded-lg w-full placeholder:text-muted focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20 transition-all duration-200"
                required
              />
            </div>
            
            <div>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }}
                className="bg-[#0F172A] border border-[#334155] text-white px-4 py-3 rounded-lg w-full placeholder:text-muted focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20 transition-all duration-200"
                required
              />
            </div>
            
            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }}
                className="bg-[#0F172A] border border-[#334155] text-white px-4 py-3 rounded-lg w-full placeholder:text-muted focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20 transition-all duration-200"
                required
              />
            </div>
            
            <div>
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setErrorMsg(''); }}
                className="bg-[#0F172A] border border-[#334155] text-white px-4 py-3 rounded-lg w-full placeholder:text-muted focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20 transition-all duration-200"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#22C55E] hover:bg-[#16a34a] focus:bg-[#16a34a] text-white font-semibold rounded-xl py-3 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          {/* Links */}
          <div className="mt-6 text-center space-y-3">
            <Link href="/login" className="text-[#22C55E] hover:text-[#16a34a] transition-colors block text-sm">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 