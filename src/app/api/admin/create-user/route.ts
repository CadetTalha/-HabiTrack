// ════════════════════════════════════════════════════════════
// POST /api/admin/create-user
// Creates a new user directly (no invite email) with full profile.
// Uses Supabase admin client — only callable by admins.
// ════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
    try {
        const supabase = await createServerSupabaseClient();

        // 1. Auth check
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // 2. Admin only
        const { data: callerProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (callerProfile?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden — Admins only.' }, { status: 403 });
        }

        // 3. Parse body
        const body = await request.json();
        const { email, password, full_name, role, university, degree, mobile_number, murabbi_id } = body;

        if (!email || !password || !full_name || !role) {
            return NextResponse.json({ error: 'email, password, full_name and role are required.' }, { status: 400 });
        }
        if (!['admin', 'murabbi', 'salik'].includes(role)) {
            return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
        }
        if (password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
        }

        const adminSupabase = await createAdminSupabaseClient();

        // 4. Create the auth user (email confirmed immediately, no invite email)
        const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,   // ← skips email confirmation; user can log in immediately
            user_metadata: {
                full_name,
                role,
                is_profile_complete: true,
            },
        });

        if (createError) {
            return NextResponse.json({ error: createError.message }, { status: 400 });
        }

        const uid = newUser.user.id;

        // 5. Upsert profile (the DB trigger creates a row; we just overwrite with complete data)
        const { error: profileError } = await adminSupabase
            .from('profiles')
            .upsert({
                id: uid,
                email,
                full_name,
                role,
                university: university || null,
                degree: degree || null,
                mobile_number: mobile_number || null,
                is_profile_complete: true,
                updated_at: new Date().toISOString(),
            });

        if (profileError) {
            // Rollback: delete the auth user so we don't leave orphan auth accounts
            await adminSupabase.auth.admin.deleteUser(uid);
            return NextResponse.json({ error: 'Failed to create profile: ' + profileError.message }, { status: 500 });
        }

        // 6. If Salik and murabbi selected, create the assignment
        if (role === 'salik' && murabbi_id) {
            await adminSupabase.from('salik_murabbi_map').insert({
                salik_id: uid,
                murabbi_id,
                is_active: true,
            });
        }

        // 7. Log activity
        await supabase.from('activity_logs').insert({
            user_id: user.id,
            action: 'USER_CREATED',
            details: `Created ${role} account for ${full_name} (${email})`,
        });

        return NextResponse.json({ message: 'User created successfully', userId: uid });

    } catch (error) {
        console.error('Create user error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
