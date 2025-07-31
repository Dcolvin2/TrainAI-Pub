'use client';
import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (!user) {
    return <div className="p-4">Please log in to view your dashboard.</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Welcome Back!</h2>
          <p className="text-gray-600">Hello, {user.email}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <a href="/claude-workout" className="block text-blue-600 hover:underline">
              Generate Workout
            </a>
            <a href="/claude-test" className="block text-blue-600 hover:underline">
              Test Claude
            </a>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Account</h2>
          <p className="text-gray-600">Manage your profile and settings</p>
        </div>
      </div>
    </div>
  );
} 