import { createAdminSupabase } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { notFound } from 'next/navigation';
import { UserActions } from './actions';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function UserDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createAdminSupabase();

  const { data: user } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (!user) notFound();

  const { data: strikes } = await supabase
    .from('strikes')
    .select('id, type, reason, auto_generated, created_at')
    .eq('user_id', id)
    .order('created_at', { ascending: false });

  const { data: ratings } = await supabase
    .from('ratings')
    .select('id, stars, was_on_time, comment, created_at, rater:profiles!rater_id(first_name, last_name)')
    .eq('rated_id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div>
      <PageHeader
        title={`${user.first_name ?? 'Unknown'} ${user.last_name ?? ''}`}
        description={`${user.role} - ${user.phone}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile card */}
        <div className="bg-forest-800 rounded-lg p-5 border border-forest-700">
          <h3 className="text-white font-semibold mb-3">Profile</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-forest-400">Phone</dt>
              <dd className="text-gray-300 font-mono">{user.phone}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Email</dt>
              <dd className="text-gray-300">{user.email ?? '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Role</dt>
              <dd className="text-gray-300">{user.role}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Account Status</dt>
              <dd><StatusBadge status={user.account_status} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Rating</dt>
              <dd className="text-gray-300">{user.rating_avg ?? '0'} / 5</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Punctuality</dt>
              <dd className="text-gray-300">{user.punctuality_pct ?? 100}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Strikes</dt>
              <dd className="text-gray-300">{user.strikes_soft} soft, {user.strikes_hard} hard</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Joined</dt>
              <dd className="text-gray-300">{new Date(user.created_at).toLocaleDateString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Last Active</dt>
              <dd className="text-gray-300">{user.last_active_at ? new Date(user.last_active_at).toLocaleDateString() : '-'}</dd>
            </div>
          </dl>
        </div>

        {/* Actions */}
        <div className="bg-forest-800 rounded-lg p-5 border border-forest-700">
          <h3 className="text-white font-semibold mb-3">Admin Actions</h3>
          <UserActions userId={id} currentStatus={user.account_status} />
        </div>

        {/* Strikes */}
        <div className="bg-forest-800 rounded-lg p-5 border border-forest-700 lg:col-span-2">
          <h3 className="text-white font-semibold mb-3">Strike History</h3>
          {(!strikes || strikes.length === 0) ? (
            <p className="text-forest-400 text-sm">No strikes.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-forest-400 border-b border-forest-700">
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Reason</th>
                  <th className="pb-2 pr-4">Auto</th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {strikes.map((s: any) => (
                  <tr key={s.id} className="border-b border-forest-800">
                    <td className="py-2 pr-4">
                      <StatusBadge status={s.type === 'hard' ? 'suspended' : 'restricted'} />
                    </td>
                    <td className="py-2 pr-4">{s.reason}</td>
                    <td className="py-2 pr-4 text-xs">{s.auto_generated ? 'Yes' : 'No'}</td>
                    <td className="py-2 text-xs text-forest-400">{new Date(s.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent ratings */}
        <div className="bg-forest-800 rounded-lg p-5 border border-forest-700 lg:col-span-2">
          <h3 className="text-white font-semibold mb-3">Recent Ratings</h3>
          {(!ratings || ratings.length === 0) ? (
            <p className="text-forest-400 text-sm">No ratings yet.</p>
          ) : (
            <div className="space-y-3">
              {ratings.map((r: any) => (
                <div key={r.id} className="border-b border-forest-700 pb-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-yellow-400">{'*'.repeat(r.stars)}</span>
                    <span className="text-forest-400 text-xs">
                      by {r.rater?.first_name ?? 'Unknown'} {r.rater?.last_name ?? ''}
                    </span>
                    <span className="text-forest-500 text-xs ml-auto">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {r.comment && <p className="text-gray-300 text-sm mt-1">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
