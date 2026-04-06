'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  flagId: string;
  targetType: string;
  targetId: string;
  currentStatus: string;
}

export function FlagActions({ flagId, targetType, targetId, currentStatus }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (currentStatus !== 'pending') {
    return <p className="text-forest-400 text-sm">This flag has already been reviewed: {currentStatus}</p>;
  }

  async function handleAction(action: 'dismiss' | 'remove_post' | 'suspend_user' | 'issue_strike') {
    setLoading(true);
    try {
      const res = await fetch('/api/flags/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagId, targetType, targetId, action, reason: reason.trim() || undefined }),
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
      console.error('Flag action failed:', err);
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
        placeholder="Reason / notes"
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-forest-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent"
        rows={2}
      />
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => handleAction('dismiss')}
          disabled={loading}
          className="px-4 py-2 bg-forest-600 text-white rounded-lg text-sm font-medium hover:bg-forest-500 disabled:opacity-50 transition-colors"
        >
          Dismiss Flag
        </button>
        {targetType === 'post' && (
          <button
            onClick={() => handleAction('remove_post')}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 disabled:opacity-50 transition-colors"
          >
            Remove Post
          </button>
        )}
        {targetType === 'user' && (
          <button
            onClick={() => handleAction('suspend_user')}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 disabled:opacity-50 transition-colors"
          >
            Suspend User
          </button>
        )}
        <button
          onClick={() => handleAction('issue_strike')}
          disabled={loading}
          className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-500 disabled:opacity-50 transition-colors"
        >
          Issue Strike
        </button>
      </div>
    </div>
  );
}
