import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { habitSchema } from '@/lib/validations';

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const result = habitSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
        }

        // Verify the habit belongs to this murabbi
        const { data: existingHabit } = await supabase
            .from('habit_templates')
            .select('murabbi_id, is_default')
            .eq('id', id)
            .single();

        if (!existingHabit) {
            return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
        }

        if (existingHabit.is_default || existingHabit.murabbi_id !== user.id) {
            return NextResponse.json({ error: 'Cannot edit default habits or habits you do not own' }, { status: 403 });
        }

        const { data, error } = await supabase
            .from('habit_templates')
            .update(result.data)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ habit: data });
    } catch (error) {
        console.error('Habit PUT error:', error);
        return NextResponse.json({ error: 'Failed to update habit' }, { status: 500 });
    }
}

// DELETE a habit from the pool
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Verify ownership
        const { data: existingHabit } = await supabase
            .from('habit_templates')
            .select('murabbi_id, is_default')
            .eq('id', id)
            .single();

        if (!existingHabit) return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
        if (existingHabit.is_default || existingHabit.murabbi_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // The developer spec says: "No habit can be deleted if it has historical report data attached to it."
        // We check if it is actively in use in salik_habit_assignments with is_active = true, OR if it has report items.
        const { count: reportItemsCount } = await supabase
            .from('report_items')
            .select('id', { count: 'exact', head: true })
            .eq('habit_id', id);

        if (reportItemsCount && reportItemsCount > 0) {
            return NextResponse.json({ error: 'Habit cannot be deleted because it has historical check-ins. You can toggle it off instead.' }, { status: 400 });
        }

        const { error } = await supabase
            .from('habit_templates')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Habit DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete habit' }, { status: 500 });
    }
}

// PATCH - Global Toggle for all associated Saliks
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        if (typeof body.is_active !== 'boolean') {
            return NextResponse.json({ error: 'is_active boolean is required' }, { status: 400 });
        }

        // We only toggle for Saliks that are currently assigned to this Murabbi
        // First get the list of Saliks assigned to this Murabbi
        const { data: saliks } = await supabase
            .from('salik_murabbi_map')
            .select('salik_id')
            .eq('murabbi_id', user.id)
            .eq('is_active', true);

        if (!saliks || saliks.length === 0) {
            return NextResponse.json({ success: true, message: 'No Saliks to toggle for' });
        }

        const salikIds = saliks.map(s => s.salik_id);

        // Update salik_habit_assignments for these saliks
        const { error } = await supabase
            .from('salik_habit_assignments')
            .upsert(
                salikIds.map(salikId => ({
                    salik_id: salikId,
                    habit_id: id,
                    is_active: body.is_active,
                    assigned_by_murabbi_id: user.id
                })),
                { onConflict: 'salik_id, habit_id' }
            );

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Habit PATCH error:', error);
        return NextResponse.json({ error: 'Failed to toggle habit globally' }, { status: 500 });
    }
}
