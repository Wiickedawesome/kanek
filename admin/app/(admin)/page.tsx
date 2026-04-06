import { createAdminSupabase } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';

async function getStats() {
  const supabase = await createAdminSupabase();

  const [
    { count: totalUsers },
    { count: pendingDrivers },
    { count: pendingRiderDocs },
    { count: pendingFlags },
    { count: activePosts },
    { count: completedTrips },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('driver_details').select('*', { count: 'exact', head: true }).eq('review_status', 'pending'),
    supabase.from('rider_documents').select('*', { count: 'exact', head: true }).eq('review_status', 'pending'),
    supabase.from('flags').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('posts').select('*', { count: 'exact', head: true }).in('status', ['open', 'activated', 'in_progress']),
    supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
  ]);

  return {
    totalUsers: totalUsers ?? 0,
    pendingDrivers: pendingDrivers ?? 0,
    pendingRiderDocs: pendingRiderDocs ?? 0,
    pendingFlags: pendingFlags ?? 0,
    activePosts: activePosts ?? 0,
    completedTrips: completedTrips ?? 0,
  };
}

async function getRecentActions() {
  const supabase = await createAdminSupabase();
  const { data } = await supabase
    .from('admin_actions')
    .select('id, action, target_type, reason, created_at, admin:profiles!admin_id(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(10);
  return data ?? [];
}

export default async function DashboardPage() {
  const [stats, recentActions] = await Promise.all([getStats(), getRecentActions()]);

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, href: '/users' },
    { label: 'Pending Drivers', value: stats.pendingDrivers, href: '/drivers', urgent: stats.pendingDrivers > 0 },
    { label: 'Pending Rider Docs', value: stats.pendingRiderDocs, href: '/riders', urgent: stats.pendingRiderDocs > 0 },
    { label: 'Pending Flags', value: stats.pendingFlags, href: '/flags', urgent: stats.pendingFlags > 0 },
    { label: 'Active Posts', value: stats.activePosts, href: '/posts' },
    { label: 'Completed Trips', value: stats.completedTrips },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of kanek platform activity" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {cards.map((card) => (
          <a
            key={card.label}
            href={card.href ?? '#'}
            className={`block rounded-lg p-5 transition-colors ${
              card.urgent
                ? 'bg-yellow-50 border border-yellow-200 hover:bg-yellow-100'
                : 'bg-white border border-gray-200 hover:bg-gray-50 shadow-sm'
            }`}
          >
            <p className="text-sm text-forest-400">{card.label}</p>
            <p className={`text-3xl font-bold mt-1 ${card.urgent ? 'text-yellow-600' : 'text-forest-900'}`}>
              {card.value}
            </p>
          </a>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-forest-900 mb-3">Recent Admin Actions</h2>
        {recentActions.length === 0 ? (
          <p className="text-forest-400 text-sm">No admin actions yet.</p>
        ) : (
          <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-forest-400 border-b border-gray-200">
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody className="text-forest-900">
                {recentActions.map((a: any) => (
                  <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{a.action}</td>
                    <td className="px-4 py-3 text-xs">{a.target_type}</td>
                    <td className="px-4 py-3">
                      {a.admin?.first_name ?? 'Unknown'} {a.admin?.last_name ?? ''}
                    </td>
                    <td className="px-4 py-3 max-w-48 truncate text-gray-500">{a.reason ?? '-'}</td>
                    <td className="px-4 py-3 text-xs text-forest-400">
                      {new Date(a.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
