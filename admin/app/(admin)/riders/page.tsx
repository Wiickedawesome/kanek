import { createAdminSupabase } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import Link from 'next/link';

export default async function RidersPage() {
  const supabase = await createAdminSupabase();

  const { data: docs } = await supabase
    .from('rider_documents')
    .select('id, document_url, review_status, rejection_reason, uploaded_at, user:profiles!user_id(first_name, last_name, phone)')
    .order('review_status', { ascending: true })
    .order('uploaded_at', { ascending: false });

  return (
    <div>
      <PageHeader title="Rider Documents" description="Review and verify rider identity documents" />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-forest-400 border-b border-forest-700">
              <th className="pb-2 pr-4">Rider</th>
              <th className="pb-2 pr-4">Phone</th>
              <th className="pb-2 pr-4">Uploaded</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {(docs ?? []).map((d: any) => (
              <tr key={d.id} className="border-b border-forest-800 hover:bg-forest-800/50">
                <td className="py-3 pr-4">
                  {d.user?.first_name ?? 'Unknown'} {d.user?.last_name ?? ''}
                </td>
                <td className="py-3 pr-4 text-xs font-mono">{d.user?.phone}</td>
                <td className="py-3 pr-4 text-xs text-forest-400">
                  {new Date(d.uploaded_at).toLocaleDateString()}
                </td>
                <td className="py-3 pr-4">
                  <StatusBadge status={d.review_status} />
                </td>
                <td className="py-3">
                  <Link
                    href={`/riders/${d.id}`}
                    className="text-accent-green hover:underline text-xs font-medium"
                  >
                    Review
                  </Link>
                </td>
              </tr>
            ))}
            {(!docs || docs.length === 0) && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-forest-400">
                  No rider documents found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
