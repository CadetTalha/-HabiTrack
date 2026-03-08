import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import { inviteSchema } from '@/lib/validations';

export async function POST(request: Request) {
    try {
        const supabase = await createServerSupabaseClient();

        // 1. Verify user is logged in
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // 2. Verify user is extremely privileged (admin)
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden. Only administrators can invite users.' }, { status: 403 });
        }

        // 3. Parse input
        const body = await request.json();
        const result = inviteSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
        }

        const { email, role } = result.data;

        // 4. Trigger Supabase Auth Invite via Service Role
        const adminSupabase = await createAdminSupabaseClient();

        const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
            data: {
                role,               // Passes cleanly to the supabase raw_user_meta_data trigger
                is_profile_complete: false,
                full_name: 'Pending Setup'
            },
        });

        if (inviteError) {
            // Note: If user already exists, Supabase throws an error or sends recovery
            return NextResponse.json({ error: inviteError.message }, { status: 400 });
        }

        // Log Activity
        await supabase.from('activity_logs').insert({
            user_id: user.id,
            action: 'INVITE_SENT',
            details: `Invited user ${email} as ${role}`
        });

        return NextResponse.json({
            message: 'User invited successfully',
            user: inviteData.user
        });

    } catch (error) {
        console.error('Invite error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
