import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const notificationSchema = z.object({
    salik_id: z.string().uuid(),
    title: z.string().min(1).max(100),
    message: z.string().min(1).max(500),
});

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const result = notificationSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
        }

        const { salik_id, title, message } = result.data;

        // Verify that the caller is the Murabbi assigned to this Salik, or an Admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        let isAuthorized = profile?.role === 'admin';

        if (!isAuthorized && profile?.role === 'murabbi') {
            const { data: mapping } = await supabase
                .from('salik_murabbi_map')
                .select('id')
                .eq('salik_id', salik_id)
                .eq('murabbi_id', user.id)
                .eq('is_active', true)
                .single();
            if (mapping) isAuthorized = true;
        }

        if (!isAuthorized) {
            return NextResponse.json({ error: 'Forbidden. You do not manage this Salik.' }, { status: 403 });
        }

        // Send the notification
        const { error } = await supabase
            .from('notifications')
            .insert({
                user_id: salik_id,
                title,
                message,
                type: 'system',
                is_read: false
            });

        if (error) throw error;

        return NextResponse.json({ success: true, message: 'Notification sent successfully' }, { status: 201 });
    } catch (error) {
        console.error('Notification POST error:', error);
        return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
    }
}
