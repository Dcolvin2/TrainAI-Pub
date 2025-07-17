'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AccountPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [origEmail, setOrigEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | null }>({ text: '', type: null });

  useEffect(() => {
    const init = async () => {
      const { data: sess } = await supabase.auth.getSession();
      const currentUser = sess.session?.user;
      if (!currentUser) {
        router.replace('/login');
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('user_id', currentUser.id)
        .single();

      if (error) {
        console.error(error);
        setLoading(false);
        setMessage({ text: error.message, type: 'error' });
        return;
      }

      setFirstName(data?.first_name ?? '');
      setEmail(currentUser.email ?? '');
      setOrigEmail(currentUser.email ?? '');
      setLoading(false);
    };

    init();
  }, [router]);

  const handleSave = async () => {
    const { data: sess } = await supabase.auth.getSession();
    const currentUser = sess.session?.user;
    if (!currentUser) return;
    setSaving(true);

    // Change email if modified
    if (email !== origEmail) {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) {
        setMessage({ text: 'Email update failed: ' + error.message, type: 'error' });
        setSaving(false);
        return;
      } else {
        setMessage({ text: 'Check your inbox to confirm the new email.', type: 'success' });
      }
    }

    // Update profile fields
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ first_name: firstName })
      .eq('user_id', currentUser.id);

    if (profileError) {
      setMessage({ text: 'Profile update failed: ' + profileError.message, type: 'error' });
    } else {
      setMessage({ text: 'Changes saved', type: 'success' });
      setOrigEmail(email);
    }

    setSaving(false);
  };

  if (loading) return null;

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-center">Account</h1>
      {message.type && (
        <p className={`mb-4 text-center ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{message.text}</p>
      )}
      <label className="block text-sm font-medium mb-1">First Name</label>
      <input
        className="border p-2 mb-4 block w-full rounded"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
      />
      <label className="block text-sm font-medium mb-1">Email</label>
      <input
        className="border p-2 mb-6 block w-full rounded disabled:bg-gray-100"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <button
        disabled={saving}
        className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded"
        onClick={handleSave}
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
} 