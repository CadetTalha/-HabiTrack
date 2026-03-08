// ════════════════════════════════════════════════════════════
// API: Daily Reports – GET (fetch) / POST (submit)
// ════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { dailyReportSchema } from '@/lib/validations';
import { calculateCompletion } from '@/lib/services/performance';
import { notifyChillaComplete, notifyPerformanceDrop } from '@/lib/services/notifications';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const salikId = searchParams.get('salik_id') || user.id;
        const date = searchParams.get('date');

        let query = supabase
            .from('daily_reports')
            .select('*, report_items(*, habit_template:habit_templates(*))')
            .eq('salik_id', salikId)
            .order('report_date', { ascending: false });

        if (date) {
            query = query.eq('report_date', date);
        } else {
            query = query.limit(40);
        }

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ reports: data });
    } catch (error) {
        console.error('Reports GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const result = dailyReportSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
        }

        const { report_date, notes, items } = result.data;

        // Check for existing report on this date to handle the 30-min window constraint
        const { data: existingReport } = await supabase
            .from('daily_reports')
            .select('id, submitted_at')
            .eq('salik_id', user.id)
            .eq('report_date', report_date)
            .single();

        let reportId = null;

        if (existingReport) {
            // Check 30 minute window
            const submissionTime = new Date(existingReport.submitted_at).getTime();
            const now = new Date().getTime();
            const differenceInMinutes = (now - submissionTime) / (1000 * 60);

            if (differenceInMinutes > 30) {
                return NextResponse.json({ error: 'The 30-minute edit window has expired for this report.' }, { status: 403 });
            }
            reportId = existingReport.id;
        }

        // Calculate completion percentage: only "completed" status counts.
        const completedCount = items.filter((i) => i.status === 'completed').length;
        const totalCount = items.length; // Ensure this is mapped accurately from their assigned pool
        const completionPct = calculateCompletion(completedCount, totalCount);

        let reportData;

        if (reportId) {
            // Update the existing report
            const { data: report, error: reportError } = await supabase
                .from('daily_reports')
                .update({
                    completion_percentage: completionPct,
                    notes,
                    submitted_at: new Date().toISOString() // resetting window is debatable, but we just override
                })
                .eq('id', reportId)
                .select()
                .single();

            if (reportError) throw reportError;
            reportData = report;

            // Delete old items to cleanly insert new ones
            await supabase.from('report_items').delete().eq('report_id', reportId);
        } else {
            // Insert new report
            const { data: report, error: reportError } = await supabase
                .from('daily_reports')
                .insert({
                    salik_id: user.id,
                    report_date,
                    completion_percentage: completionPct,
                    notes,
                    submitted_at: new Date().toISOString()
                })
                .select()
                .single();

            if (reportError) throw reportError;
            reportData = report;
        }

        // Insert report items
        const reportItems = items.map((item) => ({
            report_id: reportData.id,
            habit_id: item.habit_id,
            status: item.status,
            input_value: item.input_value || null,
        }));

        const { error: itemsError } = await supabase
            .from('report_items')
            .insert(reportItems);

        if (itemsError) throw itemsError;

        // Log activity
        await supabase.from('activity_logs').insert({
            user_id: user.id,
            action: 'REPORT_SUBMITTED',
            details: `Completion: ${completionPct}% for ${report_date}`,
        });

        // --- CHILLA LIFECYCLE LOGIC ---
        // Get the assigned murabbi for this salik
        const { data: mapData } = await supabase
            .from('salik_murabbi_map')
            .select('murabbi_id')
            .eq('salik_id', user.id)
            .eq('is_active', true)
            .single();

        if (mapData?.murabbi_id) {
            const murabbiId = mapData.murabbi_id;

            // Check for an active chilla
            const { data: activeChilla } = await supabase
                .from('chilla_records')
                .select('*')
                .eq('salik_id', user.id)
                .eq('is_complete', false)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (!activeChilla) {
                // If it's the very first report or previous chilla completed, start a new one
                const { data: lastChilla } = await supabase
                    .from('chilla_records')
                    .select('chilla_number')
                    .eq('salik_id', user.id)
                    .order('chilla_number', { ascending: false })
                    .limit(1)
                    .single();

                const nextNumber = lastChilla ? lastChilla.chilla_number + 1 : 1;

                // End date is 39 days from report_date (Day 40)
                const startDate = new Date(report_date);
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 39);

                await supabase.from('chilla_records').insert({
                    salik_id: user.id,
                    murabbi_id: murabbiId,
                    chilla_number: nextNumber,
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0],
                    is_complete: false
                });

                await supabase.from('activity_logs').insert({
                    user_id: user.id,
                    action: 'CHILLA_STARTED',
                    details: `Started Chilla ${nextNumber}`
                });
            } else {
                // Check if Day 40 is reached (report_date >= activeChilla.end_date)
                const currentReportDate = new Date(report_date);
                const chillaEndDate = new Date(activeChilla.end_date);

                currentReportDate.setHours(0, 0, 0, 0);
                chillaEndDate.setHours(0, 0, 0, 0);

                if (currentReportDate.getTime() >= chillaEndDate.getTime()) {
                    // Mark as complete and calculate averages
                    const { data: chillaReports } = await supabase
                        .from('daily_reports')
                        .select('completion_percentage')
                        .eq('salik_id', user.id)
                        .gte('report_date', activeChilla.start_date)
                        .lte('report_date', activeChilla.end_date);

                    let avgPerformance = 0;
                    let totalSubmissions = 0;

                    if (chillaReports && chillaReports.length > 0) {
                        totalSubmissions = chillaReports.length;
                        const sum = chillaReports.reduce((acc, curr) => acc + Number(curr.completion_percentage), 0);
                        avgPerformance = sum / totalSubmissions;
                    }

                    await supabase.from('chilla_records')
                        .update({
                            is_complete: true,
                            total_submissions: totalSubmissions,
                            average_performance: avgPerformance,
                            end_date: report_date // set to actual completion date
                        })
                        .eq('id', activeChilla.id);

                    // Trigger completion notifications
                    const { data: salikProfile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
                    await notifyChillaComplete(
                        user.id,
                        murabbiId,
                        salikProfile?.full_name || 'A Salik',
                        activeChilla.chilla_number
                    );

                    await supabase.from('activity_logs').insert({
                        user_id: user.id,
                        action: 'CHILLA_COMPLETED',
                        details: `Completed Chilla ${activeChilla.chilla_number} with ${Math.round(avgPerformance)}% average`
                    });
                }
            }

            // Check for performance drop against custom system settings threshold
            const { data: settings } = await supabase.from('system_settings').select('performance_threshold').limit(1).single();
            const threshold = settings?.performance_threshold || 65;

            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 7);
            const { data: recentReports } = await supabase
                .from('daily_reports')
                .select('completion_percentage')
                .eq('salik_id', user.id)
                .gte('report_date', cutoff.toISOString().split('T')[0]);

            if (recentReports && recentReports.length > 0) {
                const recentAvg = recentReports.reduce((sum, r) => sum + Number(r.completion_percentage), 0) / recentReports.length;
                if (recentAvg < threshold) {
                    const { data: salikProfile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
                    await notifyPerformanceDrop(
                        user.id,
                        murabbiId,
                        salikProfile?.full_name || 'A Salik',
                        Math.round(recentAvg)
                    );
                }
            }
        }

        return NextResponse.json({ report: reportData, completion: completionPct }, { status: reportId ? 200 : 201 });
    } catch (error) {
        console.error('Reports POST error:', error);
        return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
    }
}
