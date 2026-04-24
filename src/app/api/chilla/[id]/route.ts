// ════════════════════════════════════════════════════════════
// API: Chilla Detail & Rich Data Aggregation – GET
// ════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // 1. Fetch Chilla Record
        const { data: chilla, error: chillaError } = await supabase
            .from('chilla_records')
            .select(`
                *,
                salik:profiles!salik_id(full_name, avatar_url),
                murabbi:profiles!murabbi_id(full_name),
                chilla_summaries(*)
            `)
            .eq('id', id)
            .single();

        if (chillaError || !chilla) throw chillaError || new Error('Chilla not found');

        // 2. Fetch Daily Reports and Items
        const { data: reports, error: reportsError } = await supabase
            .from('daily_reports')
            .select(`
                id, report_date, completion_percentage, notes,
                report_items(
                    status, 
                    habit_template:habit_templates(task_name, category)
                )
            `)
            .eq('salik_id', chilla.salik_id)
            .gte('report_date', chilla.start_date)
            .lte('report_date', chilla.end_date)
            .order('report_date', { ascending: true });

        if (reportsError) throw reportsError;

        // 3. Perform Aggregations
        const totalReports = reports?.length || 0;
        let salikNotes = '';

        let currentStreak = 0;
        let maxStreak = 0;

        // Habit statistics
        const habitStats: Record<string, { completed: number, total: number }> = {};
        const categoryStats: Record<string, { completed: number, total: number }> = {};

        // Weekly buckets
        const weeklyBuckets = [
            { sum: 0, count: 0 }, // Week 1 (Day 1-10 logically, or standard 7-day? Report says days 1-10, 11-20, 21-30, 31-40)
            { sum: 0, count: 0 },
            { sum: 0, count: 0 },
            { sum: 0, count: 0 }
        ];

        const startDateObj = new Date(chilla.start_date);

        reports?.forEach(report => {
            // Notes
            if (report.notes) {
                salikNotes += `[${report.report_date}]: ${report.notes}\n`;
            }

            // Streak 
            // We assume a report means they did *something*. 
            // Better logic: if completion > 0 (or a threshold), it's a streak. 
            // For now, submitting a report counts towards the streak if they didn't miss the day entirely.
            // Let's count days with > 0% as streak
            if (report.completion_percentage > 0) {
                currentStreak++;
                if (currentStreak > maxStreak) maxStreak = currentStreak;
            } else {
                currentStreak = 0;
            }

            // Week Buckets (10-day periods as per spec)
            const reportDateObj = new Date(report.report_date);
            const diffTime = Math.abs(reportDateObj.getTime() - startDateObj.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let bucketIndex = Math.floor(diffDays / 10);
            if (bucketIndex > 3) bucketIndex = 3; // cap at 4th bucket

            weeklyBuckets[bucketIndex].sum += Number(report.completion_percentage);
            weeklyBuckets[bucketIndex].count++;

            // Items breakdown
            report.report_items.forEach((item: any) => {
                if (!item.habit_template) return;

                const name = item.habit_template.task_name;
                const cat = item.habit_template.category;

                if (!habitStats[name]) habitStats[name] = { completed: 0, total: 0 };
                if (!categoryStats[cat]) categoryStats[cat] = { completed: 0, total: 0 };

                habitStats[name].total++;
                categoryStats[cat].total++;

                if (item.status === 'completed') {
                    habitStats[name].completed++;
                    categoryStats[cat].completed++;
                }
            });
        });

        // Finalize Averages
        const week1_avg = weeklyBuckets[0].count ? (weeklyBuckets[0].sum / weeklyBuckets[0].count).toFixed(2) : 0;
        const week2_avg = weeklyBuckets[1].count ? (weeklyBuckets[1].sum / weeklyBuckets[1].count).toFixed(2) : 0;
        const week3_avg = weeklyBuckets[2].count ? (weeklyBuckets[2].sum / weeklyBuckets[2].count).toFixed(2) : 0;
        const week4_avg = weeklyBuckets[3].count ? (weeklyBuckets[3].sum / weeklyBuckets[3].count).toFixed(2) : 0;

        const category_averages: Record<string, number> = {};
        for (const [cat, stats] of Object.entries(categoryStats)) {
            category_averages[cat] = Math.round((stats.completed / (stats.total || 1)) * 100);
        }

        const habitArray = Object.entries(habitStats).map(([name, stats]) => ({
            name,
            percentage: Math.round((stats.completed / (stats.total || 1)) * 100)
        }));

        // Sort for top 3 and bottom 3
        habitArray.sort((a, b) => b.percentage - a.percentage);
        const top_habits = habitArray.slice(0, 3);

        habitArray.sort((a, b) => a.percentage - b.percentage);
        const missed_habits = habitArray.slice(0, 3).map(h => ({
            name: h.name,
            miss_rate: 100 - h.percentage
        }));

        // Construct Rich Dataset
        const aggregation = {
            ...chilla,
            salik_name: chilla.salik.full_name,
            murabbi_name: chilla.murabbi.full_name,
            total_submissions: totalReports,
            best_streak: maxStreak,
            week1_avg,
            week2_avg,
            week3_avg,
            week4_avg,
            top_habits,
            missed_habits,
            category_averages,
            salik_notes_snapshot: salikNotes.trim()
        };

        return NextResponse.json({ aggregation }, { status: 200 });

    } catch (error) {
        console.error('Chilla Detail GET error:', error);
        return NextResponse.json({ error: 'Failed to aggregate Chilla data' }, { status: 500 });
    }
}
