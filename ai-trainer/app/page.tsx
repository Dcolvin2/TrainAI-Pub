'use client';

import Link from "next/link";
import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Show loading while checking auth status
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-foreground">Loading...</div>
      </div>
    );
  }

  // Don't render homepage for authenticated users
  if (user) {
    return null;
  }

  return (
    <main className="bg-background min-h-screen text-foreground">
      {/* Hero Section */}
      <section className="gradient-bg min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Background gradient elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5"></div>
        
        {/* Logo */}
        <img
          src="/Updatedlogo.png"
          alt="TrainAI Logo"
          className="w-32 sm:w-40 mb-6 mx-auto"
        />
        
        {/* Hero Content */}
        <div className="text-center max-w-2xl mx-auto relative z-10">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Welcome to TrainAI
          </h1>
          <p className="text-xl text-muted mb-8 leading-relaxed">
            Your AI-powered workout partner. Track progress, get stronger, and stay consistent with intelligent training guidance.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/signup">
              <button className="button-primary">
                Get Started
              </button>
            </Link>
            <Link href="/login">
              <button className="button-secondary">
                Sign In
              </button>
            </Link>
          </div>
        </div>
        
        {/* Feature highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto relative z-10">
          <div className="card text-center">
            <h3 className="text-lg font-semibold mb-2">AI-Powered</h3>
            <p className="text-muted text-sm">Intelligent workout recommendations based on your progress and goals</p>
          </div>
          <div className="card text-center">
            <h3 className="text-lg font-semibold mb-2">Track Progress</h3>
            <p className="text-muted text-sm">Monitor your strength gains and fitness improvements over time</p>
          </div>
          <div className="card text-center">
            <h3 className="text-lg font-semibold mb-2">Stay Consistent</h3>
            <p className="text-muted text-sm">Build lasting habits with personalized training schedules</p>
          </div>
        </div>
      </section>
      
      {/* Quick Actions Section */}
      <section className="py-16 px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Get Started</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Link href="/signup" className="card hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
              <h3 className="font-semibold mb-2">New Workout</h3>
              <p className="text-muted text-sm">Create a personalized training session</p>
            </Link>
            <Link href="/signup" className="card hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
              <h3 className="font-semibold mb-2">Dashboard</h3>
              <p className="text-muted text-sm">View your progress and statistics</p>
            </Link>
            <Link href="/signup" className="card hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
              <h3 className="font-semibold mb-2">Equipment</h3>
              <p className="text-muted text-sm">Manage your available equipment</p>
            </Link>
            <Link href="/signup" className="card hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
              <h3 className="font-semibold mb-2">Profile</h3>
              <p className="text-muted text-sm">Update your personal information</p>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
