import { createAdminSupabase } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import Link from 'next/link';

export default async function FlagsPage() {
  const supabase = await createAdminSupabase();

  const { data: flags } = await supabase
    .from('flags')
    .select('id, target_type, target_id, reason, description, status, created_at, reporter:profiles!reporter_id(first_name, last_name)')
    .order('status', { ascending: true })
    .order('created_at', { ascending: false });

  return (
    <div>
      <PageHeader title="Flags" description="Review and moderate community reports" />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-forest-400 border-b border-forest-700">
              <th className="pb-2 pr-4">Target</th>
              <th className="pb-2 pr-4">Reason</th>
              <th className="pb-2 pr-4">Reporter</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">Date</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {(flags ?? []).map((f: any) => (
              <tr key={f.id} className="border-b border-forest-800 hover:bg-forest-800/50">
                <td className="py-3 pr-4 text-xs">
                  <span className="font-mono">{f.target_type}</span>
                </td>
                <td className="py-3 pr-4 text-xs">{f.reason}</td>
                <td className="py-3 pr-4">
                  {f.reporter?.first_name ?? 'Unknown'} {f.reporter?.last_name ?? ''}
                </td>
                <td className="py-3 pr-4">
                  <StatusBadge status={f.status} />
                </td>
                <td className="py-3 pr-4 text-xs text-forest-400">
                  {new Date(f.created_at).toLocaleDateString()}
                </td>
                <td className="py-3">
                  <Link
                    href={`/flags/${f.id}`}
                    className="text-accent-green hover:underline text-xs font-medium"
                  >
                    Review
                  </Link>
                </td>
              </tr>
            ))}
            {(!flags || flags.length === 0) && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-forest-400">
                  No flags found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
