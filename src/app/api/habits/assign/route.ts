import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { habit_id, salik_id, action } = body;

        if (!habit_id || !salik_id || !['assign', 'remove', 'toggle'].includes(action)) {
            return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
        }

        // Ensure this Murabbi actually owns this Salik
        const { data: mapAuth } = await supabase
            .from('salik_murabbi_map')
            .select('id')
            .eq('salik_id', salik_id)
            .eq('murabbi_id', user.id)
            .eq('is_active', true)
            .single();

        if (!mapAuth) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        let is_active = true;
        if (action === 'remove') is_active = false;
        if (action === 'toggle') {
            if (typeof body.is_active === 'boolean') {
                is_active = body.is_active;
            } else {
                return NextResponse.json({ error: 'is_active boolean is required for toggle action' }, { status: 400 });
            }
        }

        const { data, error } = await supabase
            .from('salik_habit_assignments')
            .upsert({
                salik_id,
                habit_id,
                is_active,
                assigned_by_murabbi_id: user.id,
            }, { onConflict: 'salik_id, habit_id' })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ assignment: data });
    } catch (error) {
        console.error('Habit Assign error:', error);
        return NextResponse.json({ error: 'Failed to assign habit' }, { status: 500 });
    }
}
