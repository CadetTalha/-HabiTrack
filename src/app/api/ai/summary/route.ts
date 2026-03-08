// ════════════════════════════════════════════════════════════
// API: AI Summary – Generate 40-Day Chilla Summary
// ════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateChillaSummary } from '@/lib/services/ai';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Verify user is a murabbi
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || profile.role !== 'murabbi') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const summary = await generateChillaSummary({
            salikName: body.salikName || 'Salik',
            chillaNumber: body.chillaNumber || 1,
            totalSubmissions: body.totalSubmissions || 0,
            completionPercentage: body.completionPercentage || 0,
            weekAverages: body.weekAverages || [0, 0, 0, 0],
            categoryAverages: body.categoryAverages || {},
            topHabits: body.topHabits || [],
            missedHabits: body.missedHabits || [],
            bestStreak: body.bestStreak || 0,
            salikNotesSnapshot: body.salikNotesSnapshot || '',
            murabbiNotesSnapshot: body.murabbiNotesSnapshot || null,
        });

        return NextResponse.json({ summary });
    } catch (error) {
        console.error('AI Summary error:', error);
        return NextResponse.json(
            { error: 'Failed to generate summary' },
            { status: 500 }
        );
    }
}
