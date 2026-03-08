import { NextResponse } from 'next/server';
import { notifySaliksNonSubmission } from '@/lib/services/notifications';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await notifySaliksNonSubmission();
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('daily-reminder cron error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
