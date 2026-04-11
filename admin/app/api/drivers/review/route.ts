import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server';
import { isValidUUID, MAX_REASON_LENGTH } from '@/lib/validation';
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const authSupabase = await createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await authSupabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { driverId, action, reason } = body as { driverId: string; action: string; reason?: string };

  if (!isValidUUID(driverId) || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (action === 'reject' && !reason) {
    return NextResponse.json({ error: 'Reason required for rejection' }, { status: 400 });
  }
  if (reason && typeof reason === 'string' && reason.length > MAX_REASON_LENGTH) {
    return NextResponse.json({ error: `Reason must be ${MAX_REASON_LENGTH} characters or less` }, { status: 400 });
  }

  const supabase = await createAdminSupabase();

  if (action === 'approve') {
    const { error } = await supabase
      .from('driver_details')
      .update({ review_status: 'approved', verified: true, verified_at: new Date().toISOString(), verified_by: user.id })
      .eq('id', driverId);
    if (error) return NextResponse.json({ error: 'Failed to update driver status' }, { status: 500 });

    await supabase.from('profiles').update({ account_status: 'active' }).eq('id', driverId);
    await supabase.from('notifications').insert({
      user_id: driverId,
      type: 'driver_verified',
      title: 'Driver documents approved',
      body: 'Your driver documents were approved. You can now post routes and accept bookings.',
      data: { userId: driverId },
    });
  } else {
    const { error } = await supabase
      .from('driver_details')
      .update({ review_status: 'rejected', rejection_reason: reason, verified: false, verified_by: user.id })
      .eq('id', driverId);
    if (error) return NextResponse.json({ error: 'Failed to update driver status' }, { status: 500 });

    await supabase.from('notifications').insert({
      user_id: driverId,
      type: 'driver_verification_rejected',
      title: 'Driver documents need changes',
      body: reason
        ? `Your driver documents were rejected: ${reason}`
        : 'Your driver documents were rejected. Please upload updated files and try again.',
      data: { userId: driverId },
    });
  }

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action: action === 'approve' ? 'approve_driver' : 'reject_driver',
    target_type: 'driver_details',
    target_id: driverId,
    reason: reason ?? null,
  });

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath('/drivers');

  return NextResponse.json({ ok: true });
}
