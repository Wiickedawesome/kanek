'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  userId: string;
  currentStatus: string;
}

export function UserActions({ userId, currentStatus }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAction(action: 'suspend' | 'unsuspend' | 'approve') {
    if (action === 'suspend' && !reason.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/users/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, reason: reason.trim() || undefined }),
      });

      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        alert('Session expired. Please refresh the page and try again.');
        return;
      }

      const body = await res.json();
      if (!res.ok) {
        alert(body.error ?? 'Action failed');
        return;
      }
      router.refresh();
    } catch (err) {
      console.error('User action failed:', err);
      alert('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required for suspension)"
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-forest-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent"
        rows={2}
      />
      <div className="flex gap-3">
        {currentStatus === 'pending' && (
          <button
            onClick={() => handleAction('approve')}
            disabled={loading}
            className="px-4 py-2 bg-accent-green text-forest-900 rounded-lg text-sm font-medium hover:bg-accent-neon disabled:opacity-50 transition-colors"
          >
            Approve User
          </button>
        )}
        {currentStatus !== 'suspended' ? (
          <button
            onClick={() => handleAction('suspend')}
            disabled={loading || !reason.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 disabled:opacity-50 transition-colors"
          >
            Suspend User
          </button>
        ) : (
          <button
            onClick={() => handleAction('unsuspend')}
            disabled={loading}
            className="px-4 py-2 bg-accent-green text-forest-900 rounded-lg text-sm font-medium hover:bg-accent-neon disabled:opacity-50 transition-colors"
          >
            Unsuspend User
          </button>
        )}
      </div>
    </div>
  );
}
