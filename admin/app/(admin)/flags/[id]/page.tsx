import { createAdminSupabase } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { notFound } from 'next/navigation';
import { FlagActions } from './actions';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FlagDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createAdminSupabase();

  const { data: flag } = await supabase
    .from('flags')
    .select('*, reporter:profiles!reporter_id(first_name, last_name, phone)')
    .eq('id', id)
    .single();

  if (!flag) notFound();

  // Fetch target details based on type
  let targetInfo: any = null;
  if (flag.target_type === 'post') {
    const { data } = await supabase.from('posts').select('id, title, type, status, author:profiles!author_id(first_name, last_name)').eq('id', flag.target_id).single();
    targetInfo = data;
  } else if (flag.target_type === 'user') {
    const { data } = await supabase.from('profiles').select('id, first_name, last_name, phone, account_status').eq('id', flag.target_id).single();
    targetInfo = data;
  }

  return (
    <div>
      <PageHeader title="Flag Review" description={`Flag #${id.slice(0, 8)}`} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
          <h3 className="text-forest-900 font-semibold mb-3">Flag Details</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-forest-400">Target Type</dt>
              <dd className="text-forest-900">{flag.target_type}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Reason</dt>
              <dd className="text-forest-900">{flag.reason}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Status</dt>
              <dd><StatusBadge status={flag.status} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Reporter</dt>
              <dd className="text-forest-900">
                {flag.reporter?.first_name ?? 'Unknown'} {flag.reporter?.last_name ?? ''}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Reported</dt>
              <dd className="text-forest-900">{new Date(flag.created_at).toLocaleDateString()}</dd>
            </div>
          </dl>
          {flag.description && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <p className="text-forest-400 text-xs mb-1">Description</p>
              <p className="text-forest-900 text-sm">{flag.description}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
          <h3 className="text-forest-900 font-semibold mb-3">Target</h3>
          {flag.target_type === 'post' && targetInfo ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-forest-400">Title</dt>
                <dd className="text-forest-900">{targetInfo.title}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-forest-400">Type</dt>
                <dd className="text-forest-900">{targetInfo.type}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-forest-400">Status</dt>
                <dd><StatusBadge status={targetInfo.status} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-forest-400">Author</dt>
                <dd className="text-forest-900">{targetInfo.author?.first_name} {targetInfo.author?.last_name}</dd>
              </div>
            </dl>
          ) : flag.target_type === 'user' && targetInfo ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-forest-400">Name</dt>
                <dd className="text-forest-900">{targetInfo.first_name} {targetInfo.last_name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-forest-400">Phone</dt>
                <dd className="text-forest-900 font-mono">{targetInfo.phone}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-forest-400">Account Status</dt>
                <dd><StatusBadge status={targetInfo.account_status} /></dd>
              </div>
            </dl>
          ) : (
            <p className="text-forest-400 text-sm">Target ID: {flag.target_id}</p>
          )}
        </div>

        <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm lg:col-span-2">
          <h3 className="text-forest-900 font-semibold mb-4">Take Action</h3>
          <FlagActions flagId={id} targetType={flag.target_type} targetId={flag.target_id} currentStatus={flag.status} />
        </div>
      </div>
    </div>
  );
}
