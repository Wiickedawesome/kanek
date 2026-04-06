import { createAdminSupabase } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import Link from 'next/link';

export default async function UsersPage() {
  const supabase = await createAdminSupabase();

  const { data: users } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, phone, role, account_status, rating_avg, strikes_soft, strikes_hard, created_at')
    .order('created_at', { ascending: false });

  return (
    <div>
      <PageHeader title="Users" description="Manage platform users" />

      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-forest-400 border-b border-gray-200">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Strikes</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="text-forest-900">
            {(users ?? []).map((u: any) => (
              <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  {u.first_name ?? 'Unknown'} {u.last_name ?? ''}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-gray-500">{u.phone}</td>
                <td className="px-4 py-3 text-xs">{u.role}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={u.account_status} />
                </td>
                <td className="px-4 py-3">{u.rating_avg ?? '0'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {u.strikes_soft}s / {u.strikes_hard}h
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/users/${u.id}`}
                    className="text-accent-green hover:underline text-xs font-medium"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {(!users || users.length === 0) && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-forest-400">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
