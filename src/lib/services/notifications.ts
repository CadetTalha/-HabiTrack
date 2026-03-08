// ════════════════════════════════════════════════════════════
// Notification Engine Service - Module 5
// ════════════════════════════════════════════════════════════
import type { Notification, NotificationType } from '@/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Core function to create a notification with deduplication and preference checking.
 */
export async function createNotification(params: {
    userId: string;
    title: string;
    message: string;
    type: NotificationType;
    actionUrl?: string;
}): Promise<Notification | null> {
    const supabase = await createServerSupabaseClient();

    // 1. DEDUPLICATION CHECK
    // Only broadcast skips deduplication. For others, max 1 identical type per user per day.
    if (params.type !== 'broadcast') {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { count } = await supabase
            .from('notifications')
            .select('id', { count: 'exact' })
            .eq('user_id', params.userId)
            .eq('type', params.type)
            .gte('created_at', todayStart.toISOString());

        if (count && count > 0) {
            console.log(`[Notifications] Deduplication blocked identical notification for user ${params.userId} of type ${params.type}`);
            return null; // Skip insertion
        }
    }

    // 2. PREFERENCE CHECK
    const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', params.userId)
        .single();

    if (prefs) {
        // Map type to preference column
        const prefMap: Record<NotificationType, keyof typeof prefs> = {
            'reminder': 'reminder_enabled',
            'alert': 'alert_enabled',
            'achievement': 'achievement_enabled',
            'summary': 'summary_enabled',
            'motivational': 'motivational_enabled',
            'info': 'info_enabled',
            'action': 'alert_enabled', // Map action to alerts usually
            'broadcast': 'broadcast_enabled'
        };

        const isEnabled = prefs[prefMap[params.type]] !== false;
        if (!isEnabled) {
            console.log(`[Notifications] User ${params.userId} opted out of type ${params.type}`);
            return null; // Opted out
        }
    }

    // 3. INSERTION
    const { data, error } = await supabase
        .from('notifications')
        .insert({
            user_id: params.userId,
            title: params.title,
            message: params.message,
            type: params.type,
            action_url: params.actionUrl || null
        })
        .select()
        .single();

    if (error) {
        console.error('Create notification error:', error);
        return null;
    }

    return data;
}

// ─── CRON JOB HANDLERS ─────────────────────────────────────────────────────────

/**
 * 10:00 PM: Remind Saliks who haven't submitted today (must be in active Chilla).
 */
export async function notifySaliksNonSubmission(): Promise<void> {
    const supabase = await createServerSupabaseClient();

    const { data: settings } = await supabase.from('system_settings').select('reminder_time').limit(1).single();
    const reminderTime = settings?.reminder_time || '22:00:00';

    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', hour12: false, hourCycle: 'h23' });
    const currentHourPKT = parseInt(formatter.format(new Date()));
    const targetHour = parseInt(reminderTime.split(':')[0]);

    if (currentHourPKT !== targetHour) {
        console.log(`[Cron] Skipping salik reminder. Target hour: ${targetHour}, Current hour (PKT): ${currentHourPKT}`);
        return;
    }

    const today = new Date().toISOString().split('T')[0];

    const { data: activeChillas } = await supabase
        .from('chilla_records')
        .select('salik_id, profiles!chilla_records_salik_id_fkey(full_name)')
        .eq('is_complete', false);

    if (!activeChillas) return;

    for (const record of activeChillas) {
        const { data: report } = await supabase
            .from('daily_reports')
            .select('id')
            .eq('salik_id', record.salik_id)
            .eq('report_date', today)
            .single();

        if (!report) {
            const name = (record.profiles as any)?.full_name || 'Salik';
            await createNotification({
                userId: record.salik_id,
                title: 'Daily Report Reminder',
                message: `Assalamu Alaikum ${name}! Don't let today pass without submitting your daily report. Istiqamah is key. 🌙`,
                type: 'reminder',
                actionUrl: '/salik/report'
            });
        }
    }
}

/**
 * 10:30 PM: Notify Murrabis of all their Saliks who haven't submitted today.
 */
export async function notifyMurrabiNonSubmission(): Promise<void> {
    const supabase = await createServerSupabaseClient();

    const { data: settings } = await supabase.from('system_settings').select('murrabi_alert_time').limit(1).single();
    const alertTime = settings?.murrabi_alert_time || '22:30:00';

    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', hour12: false, hourCycle: 'h23' });
    const currentHourPKT = parseInt(formatter.format(new Date()));
    const targetHour = parseInt(alertTime.split(':')[0]);

    if (currentHourPKT !== targetHour) {
        console.log(`[Cron] Skipping murrabi reminder. Target hour: ${targetHour}, Current hour (PKT): ${currentHourPKT}`);
        return;
    }

    const today = new Date().toISOString().split('T')[0];

    const { data: mappings } = await supabase
        .from('salik_murabbi_map')
        .select('salik_id, murabbi_id, profiles!salik_murabbi_map_salik_id_fkey(full_name)')
        .eq('is_active', true);

    if (!mappings) return;

    // Group by Murrabi
    const murabbiMap: Record<string, { id: string; name: string }[]> = {};
    mappings.forEach(m => {
        if (!murabbiMap[m.murabbi_id]) murabbiMap[m.murabbi_id] = [];
        murabbiMap[m.murabbi_id].push({
            id: m.salik_id,
            name: (m.profiles as any)?.full_name || 'A Salik'
        });
    });

    for (const murabbiId of Object.keys(murabbiMap)) {
        const saliks = murabbiMap[murabbiId];
        const missingNames: string[] = [];

        for (const s of saliks) {
            const { data: report } = await supabase
                .from('daily_reports')
                .select('id')
                .eq('salik_id', s.id)
                .eq('report_date', today)
                .single();
            if (!report) missingNames.push(s.name);
        }

        if (missingNames.length > 0) {
            const namesStr = missingNames.slice(0, 3).join(', ') + (missingNames.length > 3 ? '...' : '');
            await createNotification({
                userId: murabbiId,
                title: 'Pending Salik Reports',
                message: `${missingNames.length} of your Saliks haven't submitted today: ${namesStr}. Consider reaching out.`,
                type: 'reminder',
                actionUrl: '/murabbi/saliks'
            });
        }
    }
}

/**
 * 8:00 AM: Notify Murrabi if a Salik has zero reports in the last 5 days.
 */
export async function notifyConsecutiveMissed(): Promise<void> {
    const supabase = await createServerSupabaseClient();
    const { data: settings } = await supabase.from('system_settings').select('consecutive_miss_threshold').limit(1).single();
    const consecutiveThreshold = settings?.consecutive_miss_threshold || 5;

    const { data: mappings } = await supabase
        .from('salik_murabbi_map')
        .select('salik_id, murabbi_id, profiles!salik_murabbi_map_salik_id_fkey(full_name)')
        .eq('is_active', true);

    if (!mappings) return;

    for (const mapping of mappings) {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - consecutiveThreshold);

        const { count } = await supabase
            .from('daily_reports')
            .select('id', { count: 'exact' })
            .eq('salik_id', mapping.salik_id)
            .gte('report_date', thresholdDate.toISOString().split('T')[0]);

        if (count === 0) {
            const salikName = (mapping.profiles as any)?.full_name || 'A Salik';
            await createNotification({
                userId: mapping.murabbi_id,
                title: 'Consecutive Missed Days',
                message: `${salikName} has missed ${consecutiveThreshold} consecutive reports. They may need your support.`,
                type: 'alert',
                actionUrl: '/murabbi/saliks'
            });
        }
    }
}

/**
 * 6:00 AM: Alert Saliks with exactly 5 days remaining in their Chilla (Day 35).
 */
export async function notifyChillaMilestone(): Promise<void> {
    const supabase = await createServerSupabaseClient();

    const { data: activeChillas } = await supabase
        .from('chilla_records')
        .select('salik_id, start_date')
        .eq('is_complete', false);

    if (!activeChillas) return;

    for (const record of activeChillas) {
        const start = new Date(record.start_date);
        const now = new Date();
        start.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);
        const chillaDay = Math.ceil((now.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;

        if (chillaDay === 35) {
            await createNotification({
                userId: record.salik_id,
                title: 'Chilla Milestone',
                message: 'Only 5 days left in your Chilla! Finish strong — you\'ve come incredibly far. 💪',
                type: 'motivational',
                actionUrl: '/salik/progress'
            });
        }
    }
}

// ─── EVENT DRIVEN HANDLERS ─────────────────────────────────────────────────────────

export async function notifyChillaComplete(salikId: string, murabbiId: string, salikName: string, chillaNumber: number) {
    // Salik Side
    await createNotification({
        userId: salikId,
        title: 'Chilla Complete!',
        message: `MashaAllah! You have completed Chilla ${chillaNumber}. Your Murrabi will prepare your summary soon. 🎉`,
        type: 'achievement',
        actionUrl: '/salik/progress'
    });

    // Murrabi Side
    await createNotification({
        userId: murabbiId,
        title: 'Summary Required',
        message: `${salikName} has completed their 40-day Chilla. Generate their summary from the Chilla page.`,
        type: 'action',
        actionUrl: '/murabbi/chilla'
    });
}

export async function notifyChillaSummaryDelivered(salikId: string, murabbiName: string, chillaNumber: number) {
    return createNotification({
        userId: salikId,
        title: 'Summary Available',
        message: `Your Chilla ${chillaNumber} Summary from ${murabbiName} is ready. JazakAllah for your dedication. 🌙`,
        type: 'summary',
        actionUrl: '/salik/progress'
    });
}

export async function notifyPerformanceDrop(salikId: string, murabbiId: string, salikName: string, currentAvg: number) {
    // Salik
    await createNotification({
        userId: salikId,
        title: 'Performance Notice',
        message: `Your performance this week has dipped (${currentAvg}%). You've got this — one habit at a time. 💙`,
        type: 'alert',
        actionUrl: '/salik/progress'
    });

    // Murrabi
    await createNotification({
        userId: murabbiId,
        title: 'Performance Alert',
        message: `${salikName}'s 7-day average has dropped to ${currentAvg}%. Please check in with them.`,
        type: 'alert',
        actionUrl: '/murabbi/saliks/low-performance'
    });
}

export async function sendMurrabiEncouragement(salikId: string, message: string) {
    return createNotification({
        userId: salikId,
        title: 'Message from your Murrabi',
        message: message,
        type: 'motivational',
        actionUrl: '/salik/notifications'
    });
}

export async function getUnreadNotifications(userId: string): Promise<{ notifications: Notification[]; count: number }> {
    const supabase = await createServerSupabaseClient();
    const { data, error, count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(20);
    if (error) return { notifications: [], count: 0 };
    return { notifications: data || [], count: count || 0 };
}

export async function markNotificationsRead(notificationIds: string[]): Promise<boolean> {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', notificationIds);
    return !error;
}
