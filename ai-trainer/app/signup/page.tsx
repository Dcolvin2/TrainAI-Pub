'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import Button from '@/app/components/ui/Button';
import Input from '@/app/components/ui/Input';
import Card from '@/app/components/ui/Card';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSignup = async () => {
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/Updatedlogo.png"
            alt="TrainAI Logo"
            className="w-32 h-auto mx-auto"
          />
        </div>

        {/* Signup Card */}
        <Card className="w-full">
          <h1 className="text-2xl font-bold text-center mb-6">Join TrainAI</h1>
          
          {errorMsg && (
            <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg mb-6">
              <p className="text-sm">{errorMsg}</p>
              {errorMsg.toLowerCase().includes('already') && (
                <Link href="/forgot-password" className="text-accent hover:text-primary transition-colors text-sm underline">
                  Reset your password
                </Link>
              )}
            </div>
          )}
          
          <form onSubmit={(e) => { e.preventDefault(); handleSignup(); }} className="space-y-4">
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }}
              required
            />
            
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }}
              required
            />
            
            <Input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setErrorMsg(''); }}
              required
            />
            
            <Input
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => { setFirstName(e.target.value); setErrorMsg(''); }}
              required
            />
            
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          {/* Links */}
          <div className="mt-6 text-center">
            <Link href="/login" className="text-accent hover:text-primary transition-colors text-sm">
              Already have an account? Sign in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
} 