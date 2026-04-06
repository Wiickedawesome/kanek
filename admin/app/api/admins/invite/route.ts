import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Verify caller is an admin
  const authSupabase = await createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: callerProfile } = await authSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { email, password, firstName, lastName } = body as {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  };

  if (!email || !password || !firstName) {
    return NextResponse.json({ error: 'Email, password, and first name are required' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const supabase = await createAdminSupabase();

  // Create the auth user
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  if (!newUser.user) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }

  // Set their profile to admin role
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: newUser.user.id,
      first_name: firstName,
      last_name: lastName || null,
      role: 'admin',
      account_status: 'active',
    }, { onConflict: 'id' });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Log the admin action
  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action: 'approve_driver', // reusing closest action type
    target_type: 'profiles',
    target_id: newUser.user.id,
    reason: `Invited admin: ${email}`,
  });

  return NextResponse.json({ ok: true, userId: newUser.user.id });
}

