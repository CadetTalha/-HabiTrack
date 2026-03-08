import { ChatInterface } from '@/components/shared/ChatInterface';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function SalikChatPage() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    let suggestions = [
        "How can I build more consistency in my daily Salah?",
        "What are some simple ways to incorporate Dhikr into a busy day?",
        "Can you explain the spiritual benefits of a 40-day Chilla?",
        "I feel disconnected in my prayers. How can I regain Khushu (focus)?"
    ];

    if (user) {
        // Fetch active chilla
        const { data: chilla } = await supabase.from('chilla_records')
            .select('*')
            .eq('salik_id', user.id)
            .eq('is_complete', false)
            .single();

        // Fetch recent reports
        const { data: reports } = await supabase.from('daily_reports')
            .select('report_date, completion_percentage')
            .eq('salik_id', user.id)
            .order('report_date', { ascending: false })
            .limit(7);

        const todayStr = new Date().toISOString().split('T')[0];
        const submittedToday = reports?.some(r => r.report_date === todayStr);

        let avg7 = 100;
        if (reports && reports.length > 0) {
            avg7 = reports.reduce((sum, r) => sum + Number(r.completion_percentage), 0) / reports.length;
        }

        let mostMissedHabit = '';
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        const { data: items } = await supabase.from('report_items')
            .select('is_completed, habit_templates(title)')
            .eq('salik_id', user.id)
            .gte('created_at', cutoff.toISOString());

        if (items && items.length > 0) {
            const misses: Record<string, number> = {};
            items.forEach(i => {
                if (!i.is_completed) {
                    const title = (i.habit_templates as any)?.title;
                    if (title) misses[title] = (misses[title] || 0) + 1;
                }
            });
            let maxMiss = 0;
            Object.entries(misses).forEach(([k, v]) => {
                if (v > maxMiss) { maxMiss = v; mostMissedHabit = k; }
            });
        }

        const dynamicSuggestions = [];

        if (chilla) {
            const start = new Date(chilla.start_date);
            const now = new Date();
            start.setHours(0, 0, 0, 0); now.setHours(0, 0, 0, 0);
            const chillaDay = Math.ceil((now.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;

            dynamicSuggestions.push(`What is the spiritual significance of reaching Day ${chillaDay} of my Chilla?`);

            if (!submittedToday) {
                dynamicSuggestions.push("I haven't submitted my habits today. How can I find motivation right now?");
            }
        } else {
            dynamicSuggestions.push("How can I mentally and spiritually prepare to start a new 40-day Chilla?");
        }

        if (avg7 < 60 && dynamicSuggestions.length < 4) {
            dynamicSuggestions.push("I'm struggling to stay consistent recently. How do I get back on track?");
        }

        if (mostMissedHabit && dynamicSuggestions.length < 4) {
            dynamicSuggestions.push(`Do you have any practical advice for being more punctual with ${mostMissedHabit}?`);
        }

        // Fill remaining slots
        const pool = [...suggestions];
        while (dynamicSuggestions.length < 4 && pool.length > 0) {
            const next = pool.shift();
            if (next && !dynamicSuggestions.includes(next)) dynamicSuggestions.push(next);
        }

        suggestions = dynamicSuggestions.slice(0, 4);
    }

    return (
        <div className="h-full max-h-[calc(100vh-120px)] overflow-hidden">
            <ChatInterface role="salik" suggestions={suggestions} />
        </div>
    );
}
