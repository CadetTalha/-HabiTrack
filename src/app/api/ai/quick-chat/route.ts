// ════════════════════════════════════════════════════════════
// POST /api/ai/quick-chat
// Stateless AI chat endpoint for the floating HabiGuide widget.
// No thread/DB persistence — just send messages array, get reply.
// ════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { chatWithAI, buildSalikContext, buildMurrabiContext } from '@/lib/services/ai';

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
        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        const body = await request.json();
        const messages: { role: 'user' | 'assistant'; content: string }[] = body.messages || [];

        if (!messages.length || !messages[messages.length - 1]?.content) {
            return NextResponse.json({ error: 'messages array is required' }, { status: 400 });
        }

        // Build role-specific contextual block
        let contextBlock = '';
        if (profile.role === 'salik') {
            contextBlock = await buildSalikContext(user.id);
        } else if (profile.role === 'murabbi') {
            contextBlock = await buildMurrabiContext(user.id);
        }

        const aiRole = profile.role === 'salik' ? 'salik' : 'murrabi';
        const response = await chatWithAI(messages, aiRole as 'salik' | 'murrabi', contextBlock);

        return NextResponse.json({ response });
    } catch (error) {
        console.error('Quick chat error:', error);
        return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 });
    }
}
