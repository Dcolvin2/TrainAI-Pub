'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import TrainAILogo from '@/app/components/TrainAILogo';

export default function SignUpPage() {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      // Create user account
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
          },
        },
      });

      if (error) {
        console.error('Signup error:', error);
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      // Create profile record
      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: data.user.id,
              first_name: firstName,
              email: email,
            },
          ]);

        if (profileError) {
          console.error('Profile creation error:', profileError);
          setErrorMsg('Account created but profile setup failed. Please contact support.');
          setLoading(false);
          return;
        }
      }

      // Success → go to dashboard
      router.push('/dashboard');
    } catch (err) {
      console.error('Unexpected error:', err);
      setErrorMsg('An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex justify-center items-center mt-12 mb-6">
          <TrainAILogo size="xl" />
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