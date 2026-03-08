// ════════════════════════════════════════════════════════════
// POST /api/habits/reset-defaults
// Restores the murrabi's default template to the seed defaults
// ════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Standard default habits to re-seed from
const DEFAULT_HABITS = [
    // Prayers
    { category: 'prayers', name: 'Fajr Salah', sub_category: null, input_type: 'checkbox', is_default: true },
    { category: 'prayers', name: 'Dhuhr Salah', sub_category: null, input_type: 'checkbox', is_default: true },
    { category: 'prayers', name: 'Asr Salah', sub_category: null, input_type: 'checkbox', is_default: true },
    { category: 'prayers', name: 'Maghrib Salah', sub_category: null, input_type: 'checkbox', is_default: true },
    { category: 'prayers', name: 'Isha Salah', sub_category: null, input_type: 'checkbox', is_default: true },
    // Nawafil
    { category: 'nawafil', name: 'Tahajjud', sub_category: null, input_type: 'rakaat_dropdown', is_default: true },
    { category: 'nawafil', name: 'Ishraq', sub_category: null, input_type: 'rakaat_dropdown', is_default: true },
    // Quran
    { category: 'quran', name: 'Quran Recitation', sub_category: null, input_type: 'count_dropdown', is_default: true },
    { category: 'quran', name: 'Quran Memorization', sub_category: null, input_type: 'checkbox', is_default: true },
    // Azkar
    { category: 'azkar', name: 'Morning Azkar', sub_category: null, input_type: 'checkbox', is_default: true },
    { category: 'azkar', name: 'Evening Azkar', sub_category: null, input_type: 'checkbox', is_default: true },
    // Prohibitions
    { category: 'prohibitions', name: 'Phone — No Social Media', sub_category: null, input_type: 'checkbox', is_default: true },
    // Book Reading
    { category: 'book_reading', name: 'Islamic Book Reading', sub_category: null, input_type: 'count_dropdown', is_default: true },
];

export async function POST() {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Fetch existing default templates for this Murrabi
        const { data: existing } = await supabase
            .from('habit_templates')
            .select('name, category')
            .eq('created_by', user.id)
            .eq('is_default', true);

        const existingKeys = new Set((existing || []).map(e => `${e.category}::${e.name}`));

        // Only insert missing defaults — don't delete custom ones
        const toInsert = DEFAULT_HABITS.filter(
            h => !existingKeys.has(`${h.category}::${h.name}`)
        ).map(h => ({
            ...h,
            created_by: user.id,
            is_active: true,
            count_options: h.input_type === 'count_dropdown' ? [5, 10, 15, 20] :
                h.input_type === 'rakaat_dropdown' ? [2, 4, 6, 8] : null,
        }));

        if (toInsert.length > 0) {
            const { error } = await supabase.from('habit_templates').insert(toInsert);
            if (error) throw error;
        }

        return NextResponse.json({ success: true, inserted: toInsert.length });
    } catch (error) {
        console.error('Reset defaults error:', error);
        return NextResponse.json({ error: 'Failed to reset defaults' }, { status: 500 });
    }
}
