import { createAdminSupabase } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { formatBZD } from '@/lib/helpers';

export default async function PostsPage() {
  const supabase = await createAdminSupabase();

  const { data: posts } = await supabase
    .from('posts')
    .select('id, title, type, status, price_cents, seats_total, seats_filled, departure_at, created_at, author:profiles!author_id(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div>
      <PageHeader title="Posts" description="All community board posts" />

      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-forest-400 border-b border-gray-200">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Author</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Seats</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="text-forest-900">
            {(posts ?? []).map((p: any) => (
              <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 max-w-48 truncate">{p.title}</td>
                <td className="px-4 py-3 text-xs font-mono">{p.type}</td>
                <td className="px-4 py-3">
                  {p.author?.first_name ?? 'Unknown'} {p.author?.last_name ?? ''}
                </td>
                <td className="px-4 py-3">{p.price_cents != null ? formatBZD(p.price_cents) : '-'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {p.seats_filled ?? 0}/{p.seats_total ?? '-'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {(!posts || posts.length === 0) && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-forest-400">
                  No posts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
