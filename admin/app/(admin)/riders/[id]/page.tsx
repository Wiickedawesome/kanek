import { createAdminSupabase } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { notFound } from 'next/navigation';
import { RiderDocActions } from './actions';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RiderDocDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createAdminSupabase();

  const { data: doc } = await supabase
    .from('rider_documents')
    .select('*, user:profiles!user_id(first_name, last_name, phone, email, account_status, rating_avg, created_at)')
    .eq('id', id)
    .single();

  if (!doc) notFound();

  return (
    <div>
      <PageHeader
        title={`${doc.user?.first_name ?? 'Unknown'} ${doc.user?.last_name ?? ''}`}
        description="Rider document review"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-forest-800 rounded-lg p-5 border border-forest-700">
          <h3 className="text-white font-semibold mb-3">Rider Info</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-forest-400">Phone</dt>
              <dd className="text-gray-300 font-mono">{doc.user?.phone}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Email</dt>
              <dd className="text-gray-300">{doc.user?.email ?? '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Account Status</dt>
              <dd><StatusBadge status={doc.user?.account_status ?? 'pending'} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Rating</dt>
              <dd className="text-gray-300">{doc.user?.rating_avg ?? '0'} / 5</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Joined</dt>
              <dd className="text-gray-300">{new Date(doc.user?.created_at).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-forest-800 rounded-lg p-5 border border-forest-700">
          <h3 className="text-white font-semibold mb-3">Document</h3>
          <p className="text-forest-400 text-xs mb-2">
            Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}
          </p>
          {doc.document_url ? (
            <a
              href={doc.document_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-green hover:underline text-sm"
            >
              View Document
            </a>
          ) : (
            <span className="text-forest-500 text-sm">No document URL</span>
          )}
        </div>

        <div className="bg-forest-800 rounded-lg p-5 border border-forest-700 lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-white font-semibold">Review Status</h3>
            <StatusBadge status={doc.review_status} />
          </div>
          {doc.rejection_reason && (
            <p className="text-red-400 text-sm mb-4">
              Rejection reason: {doc.rejection_reason}
            </p>
          )}
          <RiderDocActions docId={id} currentStatus={doc.review_status} />
        </div>
      </div>
    </div>
  );
}
