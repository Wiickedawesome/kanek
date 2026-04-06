'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function InviteAdminForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admins/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Failed to create admin' });
      } else {
        setMessage({ type: 'success', text: `Admin account created for ${email}` });
        setEmail('');
        setPassword('');
        setFirstName('');
        setLastName('');
        router.refresh();
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <h3 className="text-base font-semibold text-forest-900 mb-1">Invite Admin</h3>
      <p className="text-xs text-forest-400 mb-5">
        Create an account with email &amp; password. They can sign in immediately.
      </p>

      {message && (
        <div
          className={`rounded-lg px-4 py-3 mb-4 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-forest-900 mb-1">First name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              placeholder="Jane"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-forest-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-forest-900 mb-1">Last name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-forest-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-forest-900 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="admin@example.com"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-forest-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-forest-900 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Min 8 characters"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-forest-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !email || !password || !firstName}
          className="w-full bg-accent-green text-white font-semibold py-2.5 rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors text-sm"
        >
          {loading ? 'Creating...' : 'Create Admin Account'}
        </button>
      </form>
    </div>
  );
}
