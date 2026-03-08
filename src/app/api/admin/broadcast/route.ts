// ════════════════════════════════════════════════════════════
// API: Admin Broadcast System
// ════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const body = await request.json();
        const { target, specificUserId, title, message } = body;

        if (!title || !message) {
            return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
        }

        let query = supabase.from('profiles').select('id');

        if (target === 'murabbis') query = query.eq('role', 'murabbi');
        else if (target === 'saliks') query = query.eq('role', 'salik');
        else if (target === 'specific' && specificUserId) query = query.eq('id', specificUserId);
        else if (target !== 'all') {
            return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
        }

        const { data: targetUsers, error: userError } = await query;
        if (userError) throw userError;

        if (!targetUsers || targetUsers.length === 0) {
            return NextResponse.json({ message: 'No users found matching target criteria' }, { status: 200 });
        }

        const payloads = targetUsers.map(u => ({
            user_id: u.id,
            title,
            message,
            type: 'broadcast',
            action_url: '/'
        }));

        const { error: insertError } = await supabase.from('notifications').insert(payloads);
        if (insertError) throw insertError;

        // Log Activity
        await supabase.from('activity_logs').insert({
            user_id: user.id,
            action: 'BROADCAST_SENT',
            details: `Sent broadcast to ${payloads.length} users (Target: ${target})`
        });

        // Note: We bypass notification preferences for manual Admin broadcasts.

        return NextResponse.json({ success: true, count: payloads.length });
    } catch (error: any) {
        console.error('Broadcast POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
