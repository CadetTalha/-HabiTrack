import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { habitSchema } from '@/lib/validations';

export async function GET() {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Get the user's role to determine what they can see
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        let query = supabase.from('habit_templates').select('*').order('sort_order', { ascending: true });

        if (profile.role === 'murabbi') {
            // Murabbi sees defaults + their own pool habits
            query = query.or(`is_default.eq.true,murabbi_id.eq.${user.id}`);
        } else if (profile.role === 'salik') {
            // Saliks usually fetch their assigned habits via /api/reports or similar,
            // but if they hit this, they only see defaults and ones they are explicitly assigned.
            return NextResponse.json({ error: 'Use assignment endpoints for Salik habits' }, { status: 403 });
        }

        const { data: habits, error } = await query;
        if (error) throw error;

        return NextResponse.json({ habits });
    } catch (error) {
        console.error('Habits GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch habits' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || profile.role !== 'murabbi') {
            return NextResponse.json({ error: 'Only Murabbis can add to the habit pool' }, { status: 403 });
        }

        const body = await request.json();
        const result = habitSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
        }

        const newHabit = {
            ...result.data,
            is_default: false,
            murabbi_id: user.id,
            // Automatically put pool habits at the end or sort them
            sort_order: 100,
        };

        const { data, error } = await supabase
            .from('habit_templates')
            .insert(newHabit)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ habit: data }, { status: 201 });
    } catch (error) {
        console.error('Habits POST error:', error);
        return NextResponse.json({ error: 'Failed to create habit' }, { status: 500 });
    }
}
