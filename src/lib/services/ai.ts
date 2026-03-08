// ════════════════════════════════════════════════════════════
// GROQ AI Integration Module
// Server-side only – never expose API key to client
// ════════════════════════════════════════════════════════════
import Groq from 'groq-sdk';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { calculateStreak } from './performance';

// Lazy-initialize GROQ client (server-side only, avoids build-time errors)
let _groqClient: Groq | null = null;
function getGroqClient(): Groq {
    if (!_groqClient) {
        _groqClient = new Groq({
            apiKey: process.env.GROQ_API_KEY,
        });
    }
    return _groqClient;
}

const COMMON_FORMATTING_RULES = `
=== FORMATTING GUIDELINES ===
- Conversational questions: Short, natural reply (2-4 sentences). No headers or bullets.
- Practical advice requests: Numbered steps, max 5 steps, each 1-2 sentences.
- Quranic references: Formatted as a blockquote with Surah name and ayah number.
- Hadith references: Formatted as a blockquote with source (Bukhari, Muslim, etc.).
- Long explanations: Use headers to break sections. Max 3 sections.
- Max response length: 350 words. If a topic needs more depth, end with "Would you like me to go deeper on any of these points?"
- Every response about a struggle: Must end with a short encouragement or duaa.
- NEVER start a response with filler phrases like "Certainly!", "Of course!", "Great question!".
`;

const SALIK_SYSTEM_PROMPT = `You are a warm, knowledgeable personal Islamic spiritual companion for HabiTrack AI. You are like a trusted friend who deeply understands Islamic practice and is walking this Chilla (40-day) journey alongside the Salik (student).

CAPABILITIES:
- Spiritual guidance on Salah, Dhikr, Tilawat, Nawafil, fasting, prohibitions.
- Habit-building advice tailored to the Salik's actual struggles (using their profile context).
- Motivational support referencing remaining Chilla days.
- Quranic and Hadith references for encouragement.
- Self-reflection prompts and explaining virtues of acts of worship.

BOUNDARIES (STRICTLY FORBIDDEN):
- Do NOT issue fatwas or religious legal rulings.
- Do NOT give medical or mental health advice.
- Do NOT give general life advice unrelated to spiritual practice.
- Do NOT compare the Salik to other Saliks.
- Do NOT reveal any other user's data.

TONE: Second-person, warm, encouraging, gently urgent when appropriate (e.g., near Chilla end). NEVER judgmental about missed habits.
` + COMMON_FORMATTING_RULES;

const MURRABI_SYSTEM_PROMPT = `You are a mentorship advisor and resource assistant for HabiTrack AI. You are a knowledgeable colleague who helps the Murrabi (mentor) think through how to guide their assigned Saliks (students).

CAPABILITIES:
- Answer questions about specific Saliks by name (using the Mentor Dashboard Summary context).
- Help draft motivational messages, encouragement notes, or guidance for a specific Salik.
- Suggest evidence-based approaches for common mentorship challenges (absenteeism, plateaus, specific habit struggles).
- Provide Islamic references for use in mentoring discussions.
- Help plan a Salik's next Chilla recommendations.

BOUNDARIES (STRICTLY FORBIDDEN):
- Do NOT make final decisions on behalf of the Murrabi ("You should do X with this Salik").
- Do NOT issue religious edicts or fatwas.
- Do NOT share private details of one Salik in the context of another.
- Do NOT replace the relationship between Murrabi and Salik — always frame advice as supporting the human mentor.

TONE: Collegial, professional, practical. Speak to the Murrabi as a capable mentor who needs a resource, not as a student.
` + COMMON_FORMATTING_RULES;


export async function buildSalikContext(userId: string): Promise<string> {
    const supabase = await createServerSupabaseClient();

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single();

    const { data: activeChilla } = await supabase
        .from('chilla_records')
        .select('*')
        .eq('salik_id', userId)
        .eq('is_complete', false)
        .single();

    const { data: mapping } = await supabase
        .from('salik_murabbi_map')
        .select('profiles!salik_murabbi_map_murabbi_id_fkey(full_name)')
        .eq('salik_id', userId)
        .eq('is_active', true)
        .single();

    const murabbiName = (mapping?.profiles as any)?.full_name || 'Unassigned';

    const { data: reports } = await supabase
        .from('daily_reports')
        .select('report_date, completion_percentage, id')
        .eq('salik_id', userId)
        .order('report_date', { ascending: false });

    const todayStr = new Date().toISOString().split('T')[0];
    const submittedToday = reports?.some(r => r.report_date === todayStr) ?? false;

    let chillaDay = 0;
    let daysRemaining = 0;
    let totalSubmissions = 0;

    if (activeChilla) {
        const start = new Date(activeChilla.start_date);
        const now = new Date();
        start.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);
        chillaDay = Math.ceil((now.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
        if (chillaDay < 1) chillaDay = 1;
        if (chillaDay > 40) chillaDay = 40;
        daysRemaining = 40 - chillaDay;

        const chillaReports = reports?.filter(r => r.report_date >= activeChilla.start_date) || [];
        totalSubmissions = chillaReports.length;
    }

    const last7 = reports?.slice(0, 7) || [];
    const avg7 = last7.length > 0
        ? Math.round(last7.reduce((sum, r) => sum + Number(r.completion_percentage), 0) / last7.length)
        : 0;

    const dates = (reports || []).map(r => r.report_date).reverse();
    const currentStreak = calculateStreak(dates);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 40);

    const { data: items } = await supabase
        .from('report_items')
        .select('habit_id, is_completed, habit_templates(title)')
        .eq('salik_id', userId)
        .gte('created_at', cutoffDate.toISOString());

    const habitStats: Record<string, { total: number; completed: number; name: string }> = {};
    if (items) {
        items.forEach(item => {
            const hId = item.habit_id;
            const name = (item.habit_templates as any)?.title || 'Unknown';
            if (!habitStats[hId]) habitStats[hId] = { total: 0, completed: 0, name };
            habitStats[hId].total += 1;
            if (item.is_completed) habitStats[hId].completed += 1;
        });
    }

    const statsArr = Object.values(habitStats).map(s => ({
        name: s.name,
        completionRate: Math.round((s.completed / s.total) * 100),
        missRate: Math.round(((s.total - s.completed) / s.total) * 100),
        missedCount: s.total - s.completed,
        totalCount: s.total
    }));

    const topHabits = [...statsArr].sort((a, b) => b.completionRate - a.completionRate).slice(0, 3);
    const missedHabits = [...statsArr].sort((a, b) => b.missRate - a.missRate).slice(0, 3);

    return `=== STUDENT PROFILE ===
Name: ${profile?.full_name || 'Salik'}
Current Chilla: ${activeChilla ? `Chilla ${activeChilla.chilla_number}, Day ${chillaDay} of 40` : 'Not started'}
Days Remaining: ${activeChilla ? daysRemaining : 0}
Total Submissions This Chilla: ${totalSubmissions}
7-Day Average Performance: ${avg7}%
Current Streak: ${currentStreak} days
Submitted Today: ${submittedToday ? 'Yes' : 'No'}
Assigned Murrabi: ${murabbiName}

Top 3 Most Consistent Habits:
${topHabits.map(h => `- ${h.name}: ${h.completionRate}%`).join('\n')}

Top 3 Most Frequently Missed Habits:
${missedHabits.map(h => `- ${h.name}: Missed ${h.missedCount} of ${h.totalCount} days (${h.missRate}%)`).join('\n')}

INSTRUCTION: Reference this profile when relevant to give personalised advice. Do not dump all statistics into every reply — use them naturally when they add value to the conversation.
`;
}

export async function buildMurrabiContext(userId: string): Promise<string> {
    const supabase = await createServerSupabaseClient();

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single();

    const { data: mappings } = await supabase
        .from('salik_murabbi_map')
        .select('salik_id, profiles!salik_murabbi_map_salik_id_fkey(full_name)')
        .eq('murabbi_id', userId)
        .eq('is_active', true);

    const salikIds = (mappings || []).map(m => m.salik_id);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const { data: recentReports } = await supabase
        .from('daily_reports')
        .select('salik_id, report_date, completion_percentage')
        .in('salik_id', salikIds)
        .gte('report_date', cutoffDate.toISOString());

    const { data: activeChillas } = await supabase
        .from('chilla_records')
        .select('salik_id, start_date')
        .in('salik_id', salikIds)
        .eq('is_complete', false);

    const { data: recentItems } = await supabase
        .from('report_items')
        .select('salik_id, habit_templates(title), is_completed')
        .in('salik_id', salikIds)
        .gte('created_at', cutoffDate.toISOString());

    const todayStr = new Date().toISOString().split('T')[0];

    const salikSummaries = (mappings || []).map(m => {
        const sId = m.salik_id;
        const name = (m.profiles as any)?.full_name || 'Unknown Salik';

        const sReports = (recentReports || []).filter(r => r.salik_id === sId);
        const submittedToday = sReports.some(r => r.report_date === todayStr);
        const avg7 = sReports.length > 0
            ? Math.round(sReports.reduce((sum, r) => sum + Number(r.completion_percentage), 0) / sReports.length)
            : 0;

        const chilla = (activeChillas || []).find(c => c.salik_id === sId);
        let chillaDay = 0;
        if (chilla) {
            const start = new Date(chilla.start_date);
            const now = new Date();
            start.setHours(0, 0, 0, 0);
            now.setHours(0, 0, 0, 0);
            chillaDay = Math.ceil((now.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
            if (chillaDay > 40) chillaDay = 40;
        }

        const sItems = (recentItems || []).filter(i => i.salik_id === sId);
        const habitStats: Record<string, { total: number; missed: number }> = {};
        sItems.forEach(i => {
            const hName = (i.habit_templates as any)?.title || 'Unknown';
            if (!habitStats[hName]) habitStats[hName] = { total: 0, missed: 0 };
            habitStats[hName].total += 1;
            if (!i.is_completed) habitStats[hName].missed += 1;
        });

        let mostMissed = 'None';
        let maxMissed = 0;
        Object.entries(habitStats).forEach(([hName, stats]) => {
            if (stats.missed > maxMissed) {
                maxMissed = stats.missed;
                mostMissed = hName;
            }
        });

        return {
            name,
            chillaDay,
            avg7,
            submittedToday,
            mostMissed
        };
    });

    const lowPerfSaliks = salikSummaries.filter(s => s.avg7 < 65).map(s => s.name);

    return `=== MENTOR DASHBOARD SUMMARY ===
Murrabi Name: ${profile?.full_name || 'Murrabi'}
Total Assigned Saliks: ${salikSummaries.length}

SALIK PROFILES:
${salikSummaries.map(s => `- ${s.name}: Day ${s.chillaDay} | 7-day Avg: ${s.avg7}% | Today: ${s.submittedToday ? 'Submitted' : 'Pending'} | Most Missed Issue: ${s.mostMissed}`).join('\n')}

SALIKS BELOW 65% ALERT:
${lowPerfSaliks.length > 0 ? lowPerfSaliks.join(', ') : 'None - All Saliks are above 65%'}

INSTRUCTION: You have access to your Saliks' data. When the Murrabi asks about a specific Salik by name, reference their data. Never share one Salik's private details when discussing another. Do not reveal private information like mobile numbers or email addresses.
`;
}

/**
 * Send a chat message and get AI response.
 */
export async function chatWithAI(
    messages: { role: 'user' | 'assistant'; content: string }[],
    role: 'salik' | 'murrabi',
    contextBlock: string
): Promise<string> {
    try {
        const basePrompt = role === 'salik' ? SALIK_SYSTEM_PROMPT : MURRABI_SYSTEM_PROMPT;
        const fullSystemPrompt = basePrompt + '\n\n' + contextBlock;

        const completion = await getGroqClient().chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: fullSystemPrompt },
                ...messages,
            ],
            temperature: 0.7,
            max_tokens: 1024,
        });

        return completion.choices[0]?.message?.content || 'I apologize, I could not generate a response. Please try again.';
    } catch (error) {
        console.error('GROQ AI Error:', error);
        throw new Error('Failed to get AI response');
    }
}

/**
 * Generate a 40-day (Chilla) summary using AI.
 */
export async function generateChillaSummary(data: {
    salikName: string;
    chillaNumber: number;
    totalSubmissions: number;
    completionPercentage: number;
    weekAverages: [number, number, number, number];
    categoryAverages: Record<string, number>;
    topHabits: { name: string; percentage: number }[];
    missedHabits: { name: string; miss_rate: number }[];
    bestStreak: number;
    salikNotesSnapshot: string;
    murabbiNotesSnapshot: string | null;
}): Promise<string> {

    const systemPrompt = `You are a compassionate Islamic spiritual mentor (Murabbi) writing a personalized summary for your student (Salik) who just completed their 40-day spiritual journey (Chilla).`;

    const userPrompt = `
Generate a beautifully written, encouraging summary for ${data.salikName} completing Chilla #${data.chillaNumber}.

=== PERFORMANCE DATA ===
Consistency: ${data.totalSubmissions}/40 days (${data.completionPercentage}%)
Best Streak: ${data.bestStreak} days
Weekly Trend: W1: ${data.weekAverages[0]}%, W2: ${data.weekAverages[1]}%, W3: ${data.weekAverages[2]}%, W4: ${data.weekAverages[3]}%
Categories: ${Object.entries(data.categoryAverages).map(([k, v]) => `${k} (${v}%)`).join(', ')}
Top 3 Habits: ${data.topHabits.map(h => `${h.name} (${h.percentage}%)`).join(', ')}
Struggled With: ${data.missedHabits.map(h => `${h.name} (${h.miss_rate}% missed)`).join(', ')}

=== SALIK'S REFLECTIONS ===
${data.salikNotesSnapshot || 'No personal reflections provided.'}

=== PREVIOUS MURRABI FEEDBACK ===
${data.murabbiNotesSnapshot || 'No previous feedback provided.'}

=== INSTRUCTIONS ===
1. Address ${data.salikName} directly in the second person ("You have completed...").
2. Open by acknowledging their 40-day commitment and the spiritual weight of completing a Chilla.
3. Discuss their strongest category or specific habits by name.
4. Discuss their growth areas (where they struggled) with compassion, mentioning habits by name. Do not sound harsh.
5. Note their streak and any visible trend across the 4 weeks (e.g. "Your performance improved steadily from Week 1 to Week 4").
6. Weave in their personal reflections if they provided any, acknowledging their thoughts.
7. Close with a brief, warm duaa and encouragement for their next Chilla.
8. Keep it to 4-5 well-structured paragraphs.
`;

    try {
        const completion = await getGroqClient().chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: 1200,
        });

        return completion.choices[0]?.message?.content || 'Summary could not be generated.';
    } catch (error) {
        console.error('GROQ Summary Error:', error);
        throw new Error('Failed to generate Chilla summary');
    }
}
