// ════════════════════════════════════════════════════════════
// API: System Settings
// ════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const { data, error } = await supabase.from('system_settings').select('*').limit(1).single();
        if (error) throw error;

        return NextResponse.json({ settings: data });
    } catch (error: any) {
        console.error('Settings GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const body = await request.json();

        // Find existing row ID
        const { data: currentSettings } = await supabase.from('system_settings').select('id').limit(1).single();

        if (!currentSettings) {
            return NextResponse.json({ error: 'Settings row not found' }, { status: 500 });
        }

        const updates = {
            reminder_time: body.reminder_time,
            murrabi_alert_time: body.murrabi_alert_time,
            performance_threshold: body.performance_threshold,
            consecutive_miss_threshold: body.consecutive_miss_threshold,
            updated_by: user.id
        };

        const { data, error } = await supabase
            .from('system_settings')
            .update(updates)
            .eq('id', currentSettings.id)
            .select()
            .single();

        if (error) throw error;

        // Log Activity
        await supabase.from('activity_logs').insert({
            user_id: user.id,
            action: 'SETTINGS_UPDATED',
            details: 'Updated global system settings'
        });

        return NextResponse.json({ settings: data });
    } catch (error: any) {
        console.error('Settings PUT error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
