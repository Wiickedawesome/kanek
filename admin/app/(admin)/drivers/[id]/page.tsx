import { createAdminSupabase } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { notFound } from 'next/navigation';
import { DriverActions } from './actions';

async function getDocumentUrl(supabase: any, path: string | null) {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(path, 60 * 60);

  if (error) return null;
  return data.signedUrl;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DriverDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createAdminSupabase();

  const { data: driver } = await supabase
    .from('driver_details')
    .select('*, profile:profiles!id(first_name, last_name, phone, email, role, account_status, rating_avg, punctuality_pct, strikes_soft, strikes_hard, created_at)')
    .eq('id', id)
    .single();

  if (!driver) notFound();

  const { data: riderDoc } = await supabase
    .from('rider_documents')
    .select('document_url')
    .eq('user_id', id)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const [licenseUrl, insuranceUrl, idDocumentUrl] = await Promise.all([
    getDocumentUrl(supabase, driver.license_url),
    getDocumentUrl(supabase, driver.insurance_url),
    getDocumentUrl(supabase, driver.id_document_url ?? riderDoc?.document_url ?? null),
  ]);

  const docs = [
    { label: "Driver's License", url: licenseUrl },
    { label: 'Insurance', url: insuranceUrl },
    { label: 'ID Document', url: idDocumentUrl },
  ];

  return (
    <div>
      <PageHeader
        title={`${driver.profile?.first_name ?? 'Unknown'} ${driver.profile?.last_name ?? ''}`}
        description="Driver application review"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile info */}
        <div className="bg-forest-800 rounded-lg p-5 border border-forest-700">
          <h3 className="text-white font-semibold mb-3">Profile</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-forest-400">Phone</dt>
              <dd className="text-gray-300 font-mono">{driver.profile?.phone}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Email</dt>
              <dd className="text-gray-300">{driver.profile?.email ?? '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Account Status</dt>
              <dd><StatusBadge status={driver.profile?.account_status ?? 'pending'} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Rating</dt>
              <dd className="text-gray-300">{driver.profile?.rating_avg ?? '0'} / 5</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Strikes</dt>
              <dd className="text-gray-300">{driver.profile?.strikes_soft ?? 0} soft, {driver.profile?.strikes_hard ?? 0} hard</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Joined</dt>
              <dd className="text-gray-300">{new Date(driver.profile?.created_at).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>

        {/* Vehicle info */}
        <div className="bg-forest-800 rounded-lg p-5 border border-forest-700">
          <h3 className="text-white font-semibold mb-3">Vehicle</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-forest-400">Make / Model</dt>
              <dd className="text-gray-300">{driver.vehicle_make} {driver.vehicle_model}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Year</dt>
              <dd className="text-gray-300">{driver.vehicle_year ?? '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Color</dt>
              <dd className="text-gray-300">{driver.vehicle_color ?? '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-forest-400">Plate</dt>
              <dd className="text-gray-300 font-mono">{driver.vehicle_plate ?? '-'}</dd>
            </div>
          </dl>
        </div>

        {/* Documents */}
        <div className="bg-forest-800 rounded-lg p-5 border border-forest-700 lg:col-span-2">
          <h3 className="text-white font-semibold mb-3">Documents</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {docs.map((doc) => (
              <div key={doc.label} className="text-center">
                <p className="text-forest-400 text-xs mb-2">{doc.label}</p>
                {doc.url ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-green hover:underline text-sm"
                  >
                    View Document
                  </a>
                ) : (
                  <span className="text-forest-500 text-sm">Not uploaded</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Review status + actions */}
        <div className="bg-forest-800 rounded-lg p-5 border border-forest-700 lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-white font-semibold">Review Status</h3>
            <StatusBadge status={driver.review_status} />
          </div>
          {driver.rejection_reason && (
            <p className="text-red-400 text-sm mb-4">
              Rejection reason: {driver.rejection_reason}
            </p>
          )}
          <DriverActions driverId={id} currentStatus={driver.review_status} />
        </div>
      </div>
    </div>
  );
}
