// ════════════════════════════════════════════════════════════
// API: Send Murrabi Encouragement
// ════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sendMurrabiEncouragement } from '@/lib/services/notifications';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Ensure user is a Murabbi
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role !== 'murabbi') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const body = await request.json();
        const { salikId, message } = body;

        if (!salikId || !message) {
            return NextResponse.json({ error: 'Missing salikId or message' }, { status: 400 });
        }

        // Verify assignment
        const { data: mapping } = await supabase
            .from('salik_murabbi_map')
            .select('id')
            .eq('murabbi_id', user.id)
            .eq('salik_id', salikId)
            .eq('is_active', true)
            .single();

        if (!mapping) {
            return NextResponse.json({ error: 'Salik not assigned to you' }, { status: 403 });
        }

        await sendMurrabiEncouragement(salikId, message);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Send Encouragement error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
