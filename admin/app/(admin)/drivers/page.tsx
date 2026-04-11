import { createAdminSupabase } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import Link from 'next/link';

export default async function DriversPage() {
  const supabase = await createAdminSupabase();

  const { data: drivers, error } = await supabase
    .from('driver_details')
    .select('id, vehicle_make, vehicle_model, vehicle_year, vehicle_color, vehicle_plate, review_status, verified, profile:profiles!driver_details_id_fkey(first_name, last_name, phone, created_at)')
    .order('review_status', { ascending: true })
    .limit(200);

  if (error) console.error('drivers query error:', error.message);

  return (
    <div>
      <PageHeader title="Driver Verification" description="Review and approve driver applications" />

      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-forest-400 border-b border-gray-200">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Plate</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="text-forest-900">
            {(drivers ?? []).map((d: any) => (
              <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  {d.profile?.first_name ?? 'Unknown'} {d.profile?.last_name ?? ''}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-gray-500">{d.profile?.phone}</td>
                <td className="px-4 py-3">
                  {d.vehicle_color} {d.vehicle_year} {d.vehicle_make} {d.vehicle_model}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{d.vehicle_plate ?? '-'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={d.review_status} />
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/drivers/${d.id}`}
                    className="text-accent-green hover:underline text-xs font-medium"
                  >
                    Review
                  </Link>
                </td>
              </tr>
            ))}
            {(!drivers || drivers.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-forest-400">
                  No driver applications found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
