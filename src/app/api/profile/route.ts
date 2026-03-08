// ════════════════════════════════════════════════════════════
// Profile API – Fetch/Update Personal Details
// ════════════════════════════════════════════════════════════
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/profile
 * Fetch current user's full profile details.
 */
export async function GET() {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) throw error;
        return NextResponse.json(profile);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PATCH /api/profile
 * Update personal details like name, bio, university, degree, mobile, avatar.
 */
export async function PATCH(req: Request) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();

        // Whitelist allowable fields for update
        const allowedFields = [
            'full_name',
            'avatar_url',
            'university',
            'degree',
            'mobile_number'
        ];

        const updates: any = {};
        allowedFields.forEach(field => {
            if (body[field] !== undefined) {
                updates[field] = body[field];
            }
        });

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 });
        }

        const { data: profile, error } = await supabase
            .from('profiles')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id)
            .select()
            .single();

        if (error) throw error;

        // Log the activity
        await supabase.from('activity_logs').insert({
            user_id: user.id,
            action: 'PROFILE_UPDATED',
            details: `Updated fields: ${Object.keys(updates).join(', ')}`
        });

        return NextResponse.json(profile);
    } catch (error: any) {
        console.error('Profile update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
