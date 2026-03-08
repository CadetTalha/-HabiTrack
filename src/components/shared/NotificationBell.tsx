// ════════════════════════════════════════════════════════════
// NotificationBell – Bell icon with unread count
// ════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import type { Notification, UserRole } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MdAccessAlarm, MdWarningAmber, MdAutoAwesome, MdPushPin, MdEmojiEvents, MdOutlineArticle, MdOutlineAnnouncement, MdInfoOutline, MdNotificationsActive } from 'react-icons/md';
import Link from 'next/link';

export function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [animateBell, setAnimateBell] = useState(false);
    const [role, setRole] = useState<UserRole | null>(null);
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        const fetchNotifications = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch role for 'See all' link
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
            if (profile) setRole(profile.role as UserRole);

            const { data, count } = await supabase
                .from('notifications')
                .select('*', { count: 'exact' })
                .eq('user_id', user.id)
                .eq('is_read', false)
                .order('created_at', { ascending: false })
                .limit(10);

            if (data) setNotifications(data);
            if (count !== null) setUnreadCount(count);

            // REALTIME SUBSCRIPTION
            const channel = supabase.channel('realtime_notifications')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${user.id}`
                    },
                    (payload) => {
                        const newNotif = payload.new as Notification;
                        setNotifications(prev => [newNotif, ...prev].slice(0, 10));
                        setUnreadCount(prev => prev + 1);
                        setAnimateBell(true);
                        setTimeout(() => setAnimateBell(false), 800);
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        };

        fetchNotifications();

        // 60s fallback polling just in case WS drops silently
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, [supabase]);

    const markAsRead = async (id: string) => {
        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);

        setNotifications((prev) => prev.filter((n) => n.id !== id));
        setUnreadCount((prev) => Math.max(0, prev - 1));
    };

    const handleActionClick = async (notif: Notification) => {
        await markAsRead(notif.id);
        if (notif.action_url) {
            router.push(notif.action_url);
        }
    };

    const markAllRead = async () => {
        const ids = notifications.map((n) => n.id);
        if (ids.length === 0) return;

        await supabase
            .from('notifications')
            .update({ is_read: true })
            .in('id', ids);

        setNotifications([]);
        setUnreadCount(0);
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'reminder':
                return <MdAccessAlarm className="text-blue-500 text-lg mt-0.5 flex-shrink-0" />;
            case 'alert':
                return <MdWarningAmber className="text-amber-500 text-lg mt-0.5 flex-shrink-0" />;
            case 'motivational':
                return <MdAutoAwesome className="text-purple-500 text-lg mt-0.5 flex-shrink-0" />;
            case 'achievement':
                return <MdEmojiEvents className="text-yellow-500 text-lg mt-0.5 flex-shrink-0" />;
            case 'summary':
                return <MdOutlineArticle className="text-indigo-500 text-lg mt-0.5 flex-shrink-0" />;
            case 'action':
                return <MdNotificationsActive className="text-emerald-500 text-lg mt-0.5 flex-shrink-0" />;
            case 'broadcast':
                return <MdOutlineAnnouncement className="text-rose-500 text-lg mt-0.5 flex-shrink-0" />;
            case 'info':
                return <MdInfoOutline className="text-blue-400 text-lg mt-0.5 flex-shrink-0" />;
            default:
                return <MdPushPin className="text-muted-foreground text-lg mt-0.5 flex-shrink-0" />;
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative group">
                    <motion.div animate={animateBell ? { rotate: [0, -15, 15, -15, 15, 0] } : {}}>
                        <Bell size={20} className={cn("text-muted-foreground transition-colors group-hover:text-foreground", animateBell && "text-primary")} />
                    </motion.div>
                    <AnimatePresence>
                        {unreadCount > 0 && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                className="absolute -top-0.5 -right-0.5"
                            >
                                <Badge
                                    variant="destructive"
                                    className="h-5 w-5 p-0 flex items-center justify-center text-[10px] font-bold"
                                >
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </Badge>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-[500px] flex flex-col p-0">
                <DropdownMenuLabel className="flex items-center justify-between p-4 pb-2 border-b">
                    <span className="font-semibold text-base">Notifications</span>
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllRead}
                            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                        >
                            Mark all read
                        </button>
                    )}
                </DropdownMenuLabel>

                <div className="flex-1 overflow-y-auto w-full">
                    {notifications.length === 0 ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                            <Bell size={32} className="mx-auto mb-3 opacity-20" />
                            No new notifications
                        </div>
                    ) : (
                        notifications.map((notif) => (
                            <DropdownMenuItem
                                key={notif.id}
                                className="flex items-start gap-4 p-4 cursor-pointer focus:bg-muted/50 transition-colors border-b last:border-0"
                                onClick={() => handleActionClick(notif)}
                            >
                                {getNotificationIcon(notif.type)}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold leading-tight text-foreground">
                                        {notif.title}
                                    </p>
                                    <p
                                        className={cn(
                                            'text-xs mt-1 leading-relaxed line-clamp-2',
                                            'text-muted-foreground'
                                        )}
                                    >
                                        {notif.message}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground/50 mt-2 font-medium">
                                        {new Date(notif.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                    </p>
                                </div>
                            </DropdownMenuItem>
                        ))
                    )}
                </div>

                {role && (role === 'salik' || role === 'murabbi') && (
                    <div className="p-2 border-t mt-auto shrink-0 bg-muted/20">
                        <Button variant="ghost" size="sm" className="w-full text-xs font-medium text-muted-foreground hover:text-foreground justify-center hover:bg-transparent" asChild>
                            <Link href={`/${role}/notifications`}>
                                See all notifications &rarr;
                            </Link>
                        </Button>
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
