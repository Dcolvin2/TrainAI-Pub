'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import Button from '@/app/components/ui/Button';
import Input from '@/app/components/ui/Input';
import Card from '@/app/components/ui/Card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
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
        router.push('/new-workout');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="/trainai-logo.svg"
            alt="TrainAI Logo"
            width={160}
            height={64}
            className="logo mx-auto"
          />
        </div>

        {/* Login Card */}
        <Card className="w-full">
          <h1 className="text-2xl font-bold text-center mb-6">Welcome Back</h1>
          
          {error && (
            <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}
          
          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>

          {/* Links */}
          <div className="mt-6 text-center space-y-3">
            <Link href="/signup" className="text-accent hover:text-primary transition-colors block text-sm">
              Don't have an account? Sign up
            </Link>
            <Link href="/forgot-password" className="text-muted hover:text-foreground transition-colors block text-sm">
              Forgot your password?
            </Link>
            <Link href="/magic-link" className="text-muted hover:text-foreground transition-colors block text-sm">
              Sign in with magic link
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
} 