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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-forest-400 border-b border-forest-700">
              <th className="pb-2 pr-4">Name</th>
              <th className="pb-2 pr-4">Phone</th>
              <th className="pb-2 pr-4">Role</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">Rating</th>
              <th className="pb-2 pr-4">Strikes</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {(users ?? []).map((u: any) => (
              <tr key={u.id} className="border-b border-forest-800 hover:bg-forest-800/50">
                <td className="py-3 pr-4">
                  {u.first_name ?? 'Unknown'} {u.last_name ?? ''}
                </td>
                <td className="py-3 pr-4 text-xs font-mono">{u.phone}</td>
                <td className="py-3 pr-4 text-xs">{u.role}</td>
                <td className="py-3 pr-4">
                  <StatusBadge status={u.account_status} />
                </td>
                <td className="py-3 pr-4">{u.rating_avg ?? '0'}</td>
                <td className="py-3 pr-4 text-xs">
                  {u.strikes_soft}s / {u.strikes_hard}h
                </td>
                <td className="py-3">
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
                <td colSpan={7} className="py-8 text-center text-forest-400">
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
