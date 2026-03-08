import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await context.params;

        // Verify thread ownership
        const { data: thread } = await supabase.from('ai_threads').select('id').eq('id', id).eq('user_id', user.id).single();
        if (!thread) {
            return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
        }

        const { data, error } = await supabase
            .from('ai_conversations')
            .select('*')
            .eq('thread_id', id)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ messages: data });
    } catch (error) {
        console.error('Fetch thread messages error:', error);
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await context.params;

        // Ensure user can only delete their own threads
        const { error } = await supabase
            .from('ai_threads')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete thread error:', error);
        return NextResponse.json({ error: 'Failed to delete thread' }, { status: 500 });
    }
}
