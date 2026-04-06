import { createAdminSupabase } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { InviteAdminForm } from './InviteAdminForm';

export default async function AdminsPage() {
  const supabase = await createAdminSupabase();

  const { data: admins } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, phone, created_at')
    .eq('role', 'admin')
    .order('created_at', { ascending: false });

  // Get emails from auth.users for each admin
  const adminList = await Promise.all(
    (admins ?? []).map(async (admin: any) => {
      const { data } = await supabase.auth.admin.getUserById(admin.id);
      return {
        ...admin,
        email: data?.user?.email ?? null,
      };
    }),
  );

  return (
    <div>
      <PageHeader
        title="Admin Management"
        description="Invite and manage admin accounts. Any email can be used — access is granted by adding them here."
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Admin list */}
        <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-forest-400 border-b border-gray-200">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Added</th>
              </tr>
            </thead>
            <tbody className="text-forest-900">
              {adminList.map((admin) => (
                <tr key={admin.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {admin.first_name ?? 'Unknown'} {admin.last_name ?? ''}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">
                    {admin.email ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">
                    {admin.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(admin.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {adminList.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-forest-400">
                    No admin accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Invite form */}
        <InviteAdminForm />
      </div>
    </div>
  );
}

