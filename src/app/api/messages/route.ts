// ════════════════════════════════════════════════════════════
// Messaging API – Send/Fetch Direct Messages
// ════════════════════════════════════════════════════════════
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/messages?userId=...
 * Fetch conversation history between current user and target user.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('userId');

    if (!targetUserId) {
        return NextResponse.json({ error: 'target userId is required' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch messages where (sender=Me AND receiver=Target) OR (sender=Target AND receiver=Me)
    const { data, error } = await supabase
        .from('direct_messages')
        .select(`
            *,
            sender:profiles!sender_id(full_name, avatar_url),
            receiver:profiles!receiver_id(full_name, avatar_url)
        `)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching messages:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

/**
 * POST /api/messages
 * Send a new direct message.
 * RLS handles hierarchical permission checks.
 */
export async function POST(req: Request) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { receiver_id, content } = await req.json();

        if (!receiver_id || !content) {
            return NextResponse.json({ error: 'receiver_id and content are required' }, { status: 400 });
        }

        // Insert message. Hierarchical rules are enforced by DB RLS.
        const { data, error } = await supabase
            .from('direct_messages')
            .insert({
                sender_id: user.id,
                receiver_id,
                content
            })
            .select()
            .single();

        if (error) {
            // Check if RLS blocked it (usually returns no rows or specific error)
            if (error.code === '42501') {
                return NextResponse.json({ error: 'Messaging restricted based on your role.' }, { status: 403 });
            }
            throw error;
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Error sending message:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
