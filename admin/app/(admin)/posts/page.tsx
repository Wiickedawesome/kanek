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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-forest-400 border-b border-forest-700">
              <th className="pb-2 pr-4">Title</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4">Author</th>
              <th className="pb-2 pr-4">Price</th>
              <th className="pb-2 pr-4">Seats</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2">Created</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {(posts ?? []).map((p: any) => (
              <tr key={p.id} className="border-b border-forest-800 hover:bg-forest-800/50">
                <td className="py-3 pr-4 max-w-48 truncate">{p.title}</td>
                <td className="py-3 pr-4 text-xs font-mono">{p.type}</td>
                <td className="py-3 pr-4">
                  {p.author?.first_name ?? 'Unknown'} {p.author?.last_name ?? ''}
                </td>
                <td className="py-3 pr-4">{p.price_cents != null ? formatBZD(p.price_cents) : '-'}</td>
                <td className="py-3 pr-4 text-xs">
                  {p.seats_filled ?? 0}/{p.seats_total ?? '-'}
                </td>
                <td className="py-3 pr-4">
                  <StatusBadge status={p.status} />
                </td>
                <td className="py-3 text-xs text-forest-400">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {(!posts || posts.length === 0) && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-forest-400">
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
