// ════════════════════════════════════════════════════════════
// API: Chilla Records – GET / POST
// ════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const salikId = searchParams.get('salik_id');
        const activeOnly = searchParams.get('active_only') === 'true';

        let query = supabase.from('chilla_records').select('*, profiles!salik_id(full_name, avatar_url)');

        // If user is a salik, they only get their own records.
        // If user is a murabbi, they must pass salik_id to get records for a specific salik,
        // or they get all records for their assigned saliks (handled by RLS).
        if (salikId) {
            query = query.eq('salik_id', salikId);
        } else {
            // For Salik querying their own
            query = query.eq('salik_id', user.id);
        }

        if (activeOnly) {
            query = query.eq('is_complete', false);
        }

        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ chilla_records: data }, { status: 200 });

    } catch (error) {
        console.error('Chilla GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch Chilla records' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { salik_id, murabbi_id, start_date } = body;

        if (!salik_id || !murabbi_id || !start_date) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Determine next chilla number
        const { data: lastChilla } = await supabase
            .from('chilla_records')
            .select('chilla_number')
            .eq('salik_id', salik_id)
            .order('chilla_number', { ascending: false })
            .limit(1)
            .single();

        const nextNumber = lastChilla ? lastChilla.chilla_number + 1 : 1;

        const sDate = new Date(start_date);
        const eDate = new Date(sDate);
        eDate.setDate(sDate.getDate() + 39);

        const { data: record, error } = await supabase
            .from('chilla_records')
            .insert({
                salik_id,
                murabbi_id,
                chilla_number: nextNumber,
                start_date: sDate.toISOString().split('T')[0],
                end_date: eDate.toISOString().split('T')[0],
                is_complete: false
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ chilla_record: record }, { status: 201 });

    } catch (error) {
        console.error('Chilla POST error:', error);
        return NextResponse.json({ error: 'Failed to create Chilla record' }, { status: 500 });
    }
}
