import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server';
import { isStrongPassword, MAX_NAME_LENGTH } from '@/lib/validation';
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { email, password, firstName, lastName } = body as {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  };

  if (!email || !password || !firstName) {
    return NextResponse.json({ error: 'Email, password, and first name are required' }, { status: 400 });
  }

  if (firstName.length > MAX_NAME_LENGTH || (lastName && lastName.length > MAX_NAME_LENGTH)) {
    return NextResponse.json({ error: `Name must be ${MAX_NAME_LENGTH} characters or less` }, { status: 400 });
  }

  if (!isStrongPassword(password)) {
    return NextResponse.json({ error: 'Password must be at least 12 characters with uppercase, lowercase, and a digit' }, { status: 400 });
  }

  const supabase = await createAdminSupabase();

  // Create the auth user
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    return NextResponse.json({ error: 'Failed to create admin account' }, { status: 400 });
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
    return NextResponse.json({ error: 'Failed to set up admin profile' }, { status: 500 });
  }

  // Log the admin action
  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action: 'invite_admin',
    target_type: 'profiles',
    target_id: newUser.user.id,
    reason: `Invited admin: ${email}`,
  });

  return NextResponse.json({ ok: true, userId: newUser.user.id });
}

