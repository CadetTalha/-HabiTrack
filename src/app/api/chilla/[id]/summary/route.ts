// ════════════════════════════════════════════════════════════
// API: Chilla Summary Delivery & Drafts – GET / POST / PUT
// ════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { notifyChillaSummaryDelivered } from '@/lib/services/notifications';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data, error } = await supabase
            .from('chilla_summaries')
            .select('*')
            .eq('chilla_record_id', id)
            .single();

        // It is perfectly normal to not have a summary yet
        if (error && error.code !== 'PGRST116') throw error;

        return NextResponse.json({ summary: data || null }, { status: 200 });

    } catch (error) {
        console.error('Summary GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch Chilla summary' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();

        // 1. Fetch matching record to derive murabbi, salik, chilla number
        const { data: chillaRecord } = await supabase
            .from('chilla_records')
            .select('salik_id, murabbi_id, chilla_number, start_date, end_date')
            .eq('id', id)
            .single();

        if (!chillaRecord) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

        // Ensure user is the murabbi
        if (chillaRecord.murabbi_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const isDelivered = body.is_delivered === true;

        const payload = {
            chilla_record_id: id,
            salik_id: chillaRecord.salik_id,
            murabbi_id: chillaRecord.murabbi_id,
            start_date: chillaRecord.start_date,
            end_date: chillaRecord.end_date,
            ai_summary: body.ai_summary,
            murabbi_notes: body.murabbi_notes,
            week1_avg: body.week1_avg,
            week2_avg: body.week2_avg,
            week3_avg: body.week3_avg,
            week4_avg: body.week4_avg,
            top_habits: body.top_habits,
            missed_habits: body.missed_habits,
            category_averages: body.category_averages,
            salik_notes_snapshot: body.salik_notes_snapshot,
            is_finalized: isDelivered,
            is_delivered: isDelivered,
            delivered_at: isDelivered ? new Date().toISOString() : null
        };

        // Upsert summary (match on chilla_record_id ideally, but standard id handles PK)
        // Since we didn't specify a unique constraint on chilla_record_id, we should do select-then-update or insert

        const { data: existingSummary } = await supabase
            .from('chilla_summaries')
            .select('id')
            .eq('chilla_record_id', id)
            .single();

        let updatedSummary;
        if (existingSummary) {
            const { data, error } = await supabase
                .from('chilla_summaries')
                .update(payload)
                .eq('id', existingSummary.id)
                .select()
                .single();
            if (error) throw error;
            updatedSummary = data;
        } else {
            const { data, error } = await supabase
                .from('chilla_summaries')
                .insert(payload)
                .select()
                .single();
            if (error) throw error;
            updatedSummary = data;
        }

        // Trigger notifications if delivered
        if (isDelivered) {
            // Get murabbi profile name
            const { data: murabbiProfile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
            const murabbiName = murabbiProfile?.full_name || 'Your Murabbi';

            await notifyChillaSummaryDelivered(
                chillaRecord.salik_id,
                murabbiName,
                chillaRecord.chilla_number
            );

            await supabase.from('activity_logs').insert({
                user_id: user.id,
                action: 'SUMMARY_DELIVERED',
                details: `Delivered summary for Salik ${chillaRecord.salik_id}`
            });
        } else {
            await supabase.from('activity_logs').insert({
                user_id: user.id,
                action: 'SUMMARY_GENERATED',
                details: `Drafted summary for Salik ${chillaRecord.salik_id}`
            });
        }

        return NextResponse.json({ summary: updatedSummary }, { status: 200 });

    } catch (error) {
        console.error('Summary PUT error:', error);
        return NextResponse.json({ error: 'Failed to update Chilla summary' }, { status: 500 });
    }
}
