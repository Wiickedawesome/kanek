import { createAdminSupabase } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import Link from 'next/link';

export default async function DriversPage() {
  const supabase = await createAdminSupabase();

  const { data: drivers } = await supabase
    .from('driver_details')
    .select('id, vehicle_make, vehicle_model, vehicle_year, vehicle_color, vehicle_plate, review_status, verified, profile:profiles!id(first_name, last_name, phone, created_at)')
    .order('review_status', { ascending: true });

  return (
    <div>
      <PageHeader title="Driver Verification" description="Review and approve driver applications" />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-forest-400 border-b border-forest-700">
              <th className="pb-2 pr-4">Name</th>
              <th className="pb-2 pr-4">Phone</th>
              <th className="pb-2 pr-4">Vehicle</th>
              <th className="pb-2 pr-4">Plate</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {(drivers ?? []).map((d: any) => (
              <tr key={d.id} className="border-b border-forest-800 hover:bg-forest-800/50">
                <td className="py-3 pr-4">
                  {d.profile?.first_name ?? 'Unknown'} {d.profile?.last_name ?? ''}
                </td>
                <td className="py-3 pr-4 text-xs font-mono">{d.profile?.phone}</td>
                <td className="py-3 pr-4">
                  {d.vehicle_color} {d.vehicle_year} {d.vehicle_make} {d.vehicle_model}
                </td>
                <td className="py-3 pr-4 font-mono text-xs">{d.vehicle_plate ?? '-'}</td>
                <td className="py-3 pr-4">
                  <StatusBadge status={d.review_status} />
                </td>
                <td className="py-3">
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
                <td colSpan={6} className="py-8 text-center text-forest-400">
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
