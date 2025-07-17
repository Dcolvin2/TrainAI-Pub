'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface ConnectionTest {
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
}

export default function TestConnectionPage() {
  const [tests, setTests] = useState<ConnectionTest[]>([
    { name: 'Supabase Connection', status: 'pending', message: 'Testing...' },
    { name: 'Equipment Table', status: 'pending', message: 'Testing...' },
    { name: 'Profiles Table', status: 'pending', message: 'Testing...' },
    { name: 'Authentication', status: 'pending', message: 'Testing...' },
  ]);

  const updateTest = (index: number, status: 'success' | 'error', message: string) => {
    setTests(prev => prev.map((test, i) => 
      i === index ? { ...test, status, message } : test
    ));
  };

  useEffect(() => {
    const runTests = async () => {
      // Test 1: Basic Supabase connection
      try {
        const { data, error } = await supabase.from('equipment').select('count');
        if (error) throw error;
        updateTest(0, 'success', 'Connected successfully');
      } catch (error: any) {
        updateTest(0, 'error', `Connection failed: ${error.message}`);
        return; // Stop if basic connection fails
      }

      // Test 2: Equipment table query
      try {
        const { data, error } = await supabase
          .from('equipment')
          .select('id, name')
          .limit(5);
        
        if (error) throw error;
        updateTest(1, 'success', `Found ${data?.length || 0} equipment items`);
      } catch (error: any) {
        updateTest(1, 'error', `Equipment query failed: ${error.message}`);
      }

      // Test 3: Profiles table structure
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .limit(1);
        
        if (error && !error.message.includes('0 rows')) throw error;
        updateTest(2, 'success', 'Profiles table accessible');
      } catch (error: any) {
        updateTest(2, 'error', `Profiles query failed: ${error.message}`);
      }

      // Test 4: Authentication status
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session) {
          updateTest(3, 'success', `Authenticated as ${session.user.email}`);
        } else {
          updateTest(3, 'success', 'No active session (expected for test)');
        }
      } catch (error: any) {
        updateTest(3, 'error', `Auth check failed: ${error.message}`);
      }
    };

    runTests();
  }, []);

  const getStatusIcon = (status: ConnectionTest['status']) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'success': return '✅';
      case 'error': return '❌';
    }
  };

  const getStatusColor = (status: ConnectionTest['status']) => {
    switch (status) {
      case 'pending': return 'text-yellow-600';
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center">Supabase Connection Test</h1>
      
      <div className="space-y-4">
        {tests.map((test, index) => (
          <div key={index} className="border rounded-lg p-4 bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{getStatusIcon(test.status)}</span>
                <span className="font-medium">{test.name}</span>
              </div>
              <span className={`text-sm ${getStatusColor(test.status)}`}>
                {test.status.toUpperCase()}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600 ml-8">{test.message}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">Connection Details</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <p><strong>URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL}</p>
          <p><strong>Key:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20)}...</p>
        </div>
      </div>

      <div className="mt-6 text-center">
        <a 
          href="/login" 
          className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
        >
          Go to Login Page
        </a>
      </div>
    </div>
  );
}