// ════════════════════════════════════════════════════════════
// API: Notification Preferences - GET / PUT
// ════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        let { data: prefs, error } = await supabase
            .from('notification_preferences')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error && error.code === 'PGRST116') {
            // Not found, create default
            const { data: newPrefs, error: insertError } = await supabase
                .from('notification_preferences')
                .insert({ user_id: user.id })
                .select()
                .single();

            if (insertError) throw insertError;
            prefs = newPrefs;
        } else if (error) {
            throw error;
        }

        return NextResponse.json({ preferences: prefs });
    } catch (error: any) {
        console.error('Preferences GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const updates = {
            reminder_enabled: body.reminder_enabled,
            alert_enabled: body.alert_enabled,
            achievement_enabled: body.achievement_enabled,
            summary_enabled: body.summary_enabled,
            motivational_enabled: body.motivational_enabled,
            info_enabled: body.info_enabled,
            broadcast_enabled: body.broadcast_enabled,
        };

        // Filter out undefined
        Object.keys(updates).forEach(key => updates[key as keyof typeof updates] === undefined && delete updates[key as keyof typeof updates]);

        const { data, error } = await supabase
            .from('notification_preferences')
            .update(updates)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ preferences: data });
    } catch (error: any) {
        console.error('Preferences PUT error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
