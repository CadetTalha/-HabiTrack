import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data, error } = await supabase
            .from('ai_threads')
            .select('id, title, last_message_at, created_at')
            .eq('user_id', user.id)
            .order('last_message_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ threads: data });
    } catch (error) {
        console.error('Fetch threads error:', error);
        return NextResponse.json({ error: 'Failed to fetch threads' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const firstMessage = body.first_message || '';

        let title = 'New Conversation';
        if (firstMessage && firstMessage.length > 0) {
            title = firstMessage.substring(0, 60);
            if (firstMessage.length > 60) title += '...';
        } else {
            title = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' });
        }

        const { data, error } = await supabase
            .from('ai_threads')
            .insert({
                user_id: user.id,
                title,
                last_message_at: new Date().toISOString(),
            })
            .select('id, title')
            .single();

        if (error) throw error;

        return NextResponse.json({ thread: data });
    } catch (error) {
        console.error('Create thread error:', error);
        return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
    }
}
