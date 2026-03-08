// ════════════════════════════════════════════════════════════
// API: AI Chat – POST (send message) / GET (history)
// Secure server-side GROQ integration with Thread Context
// ════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { chatWithAI, buildSalikContext, buildMurrabiContext } from '@/lib/services/ai';
import { aiChatSchema } from '@/lib/validations';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Get user role
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        const body = await request.json();
        const result = aiChatSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
        }

        const { message, thread_id } = result.data;

        // Verify thread belongs to user
        const { data: thread } = await supabase.from('ai_threads').select('id').eq('id', thread_id).eq('user_id', user.id).single();
        if (!thread) {
            return NextResponse.json({ error: 'Thread not found or unauthorized' }, { status: 403 });
        }

        // Save user message
        await supabase.from('ai_conversations').insert({
            user_id: user.id,
            thread_id,
            role: 'user',
            content: message,
        });

        // Update thread last_message_at
        await supabase.from('ai_threads').update({ last_message_at: new Date().toISOString() }).eq('id', thread_id);

        // Get recent conversation context (limit 20 = 10 pairs)
        const { data: history } = await supabase
            .from('ai_conversations')
            .select('role, content')
            .eq('thread_id', thread_id)
            .order('created_at', { ascending: false })
            .limit(20);

        const messages = (history || []).reverse().map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
        }));

        // Build context block based on role
        let contextBlock = '';
        if (profile.role === 'salik') {
            contextBlock = await buildSalikContext(user.id);
        } else if (profile.role === 'murabbi') {
            contextBlock = await buildMurrabiContext(user.id);
        }

        // Get AI response
        const response = await chatWithAI(messages, profile.role as 'salik' | 'murrabi', contextBlock);

        // Save assistant response
        await supabase.from('ai_conversations').insert({
            user_id: user.id,
            thread_id,
            role: 'assistant',
            content: response,
        });

        return NextResponse.json({ response });
    } catch (error) {
        console.error('AI Chat error:', error);
        return NextResponse.json(
            { error: 'Failed to get AI response' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const thread_id = searchParams.get('thread_id');

        if (!thread_id) {
            return NextResponse.json({ error: 'thread_id is required' }, { status: 400 });
        }

        // Verify thread ownership
        const { data: thread } = await supabase.from('ai_threads').select('id').eq('id', thread_id).eq('user_id', user.id).single();
        if (!thread) {
            return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
        }

        const { data, error } = await supabase
            .from('ai_conversations')
            .select('*')
            .eq('thread_id', thread_id)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ messages: data });
    } catch (error) {
        console.error('AI History error:', error);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
