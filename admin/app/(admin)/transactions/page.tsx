import { createAdminSupabase } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { formatBZD, formatDateTime } from '@/lib/helpers';

export default async function TransactionsPage() {
  const supabase = await createAdminSupabase();

  const { data: txns } = await supabase
    .from('ekyash_transactions')
    .select('id, order_id, amount_cents, platform_fee_cents, donation_cents, status, created_at, payer:profiles!payer_id(first_name, last_name), payee:profiles!payee_id(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(100);

  // Get donation total
  const { data: donationRow } = await supabase
    .from('donation_totals')
    .select('total_cents')
    .eq('id', 1)
    .single();

  return (
    <div>
      <PageHeader title="Transactions" description="E-Kyash payment log" />

      {donationRow && (
        <div className="bg-forest-800 rounded-lg p-4 border border-forest-700 mb-6 inline-block">
          <p className="text-forest-400 text-xs">Total Donations Collected</p>
          <p className="text-accent-green text-2xl font-bold">{formatBZD(donationRow.total_cents)}</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-forest-400 border-b border-forest-700">
              <th className="pb-2 pr-4">Order</th>
              <th className="pb-2 pr-4">Payer</th>
              <th className="pb-2 pr-4">Payee</th>
              <th className="pb-2 pr-4">Amount</th>
              <th className="pb-2 pr-4">Fee</th>
              <th className="pb-2 pr-4">Donation</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2">Date</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {(txns ?? []).map((t: any) => (
              <tr key={t.id} className="border-b border-forest-800 hover:bg-forest-800/50">
                <td className="py-3 pr-4 text-xs font-mono">{t.order_id}</td>
                <td className="py-3 pr-4">
                  {t.payer?.first_name ?? '?'} {t.payer?.last_name ?? ''}
                </td>
                <td className="py-3 pr-4">
                  {t.payee?.first_name ?? '?'} {t.payee?.last_name ?? ''}
                </td>
                <td className="py-3 pr-4 font-medium">{formatBZD(t.amount_cents)}</td>
                <td className="py-3 pr-4 text-xs">{formatBZD(t.platform_fee_cents)}</td>
                <td className="py-3 pr-4 text-xs text-accent-green">{t.donation_cents > 0 ? formatBZD(t.donation_cents) : '-'}</td>
                <td className="py-3 pr-4">
                  <StatusBadge status={t.status} />
                </td>
                <td className="py-3 text-xs text-forest-400">
                  {formatDateTime(t.created_at)}
                </td>
              </tr>
            ))}
            {(!txns || txns.length === 0) && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-forest-400">
                  No transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
