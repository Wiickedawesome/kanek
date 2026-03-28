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

  async function handleAction(action: 'suspend' | 'unsuspend') {
    if (action === 'suspend' && !reason.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/users/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, reason: reason.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json();
        alert(body.error ?? 'Action failed');
        return;
      }
      router.refresh();
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
        className="w-full bg-forest-900 border border-forest-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-forest-500 focus:outline-none focus:border-accent-green"
        rows={2}
      />
      <div className="flex gap-3">
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
