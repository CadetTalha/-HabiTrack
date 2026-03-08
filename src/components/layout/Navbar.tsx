// ════════════════════════════════════════════════════════════
// Navbar – Floating Premium Glass Header with Notifications
// ════════════════════════════════════════════════════════════
'use client';

import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Bell, BellDot, Check, Loader2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSunrise, FiSun, FiSunset, FiMoon } from 'react-icons/fi';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface AppNotification {
    id: string;
    title: string;
    message: string;
    type: string;
    is_read: boolean;
    action_url?: string;
    created_at: string;
}

const NOTIF_ICONS: Record<string, string> = {
    report_reminder: '📋',
    streak_alert: '🔥',
    chilla_summary: '📖',
    assignment_change: '📌',
    motivational: '💙',
    chilla_complete: '🏆',
    low_performance: '📉',
    achievement: '⭐',
};

export function Navbar() {
    const { profile } = useAuth();
    const supabase = createClient();
    const router = useRouter();
    const bellRef = useRef<HTMLDivElement>(null);

    const [panelOpen, setPanelOpen] = useState(false);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = useCallback(async () => {
        if (!profile) return;
        setLoading(true);
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(20);
        setNotifications(data as AppNotification[] || []);
        setUnread((data as AppNotification[] || []).filter(n => !n.is_read).length);
        setLoading(false);
    }, [profile, supabase]);

    useEffect(() => {
        if (!profile) return;
        fetchNotifications();

        // Realtime subscription for new notifications
        const channel = supabase
            .channel('navbar-notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${profile.id}`,
            }, (payload) => {
                setNotifications(prev => [payload.new as AppNotification, ...prev.slice(0, 19)]);
                setUnread(u => u + 1);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [profile, supabase, fetchNotifications]);

    // Close on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
                setPanelOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const markAsRead = async (id: string) => {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnread(u => Math.max(0, u - 1));
    };

    const markAllRead = async () => {
        if (!profile) return;
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnread(0);
    };

    const dismissNotif = async (id: string) => {
        await supabase.from('notifications').delete().eq('id', id);
        const n = notifications.find(n => n.id === id);
        setNotifications(prev => prev.filter(n => n.id !== id));
        if (n && !n.is_read) setUnread(u => Math.max(0, u - 1));
    };

    const handleNotifClick = async (notif: AppNotification) => {
        if (!notif.is_read) await markAsRead(notif.id);
        if (notif.action_url) { setPanelOpen(false); router.push(notif.action_url); }
    };

    if (!profile) return null;

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h >= 5 && h < 12) return { text: 'Assalamu Alaikum', icon: <FiSunrise className="text-amber-500 text-xl" /> };
        if (h >= 12 && h < 17) return { text: 'Assalamu Alaikum', icon: <FiSun className="text-yellow-500 text-xl" /> };
        if (h >= 17 && h < 20) return { text: 'Assalamu Alaikum', icon: <FiSunset className="text-orange-500 text-xl" /> };
        return { text: 'Assalamu Alaikum', icon: <FiMoon className="text-indigo-400 text-xl" /> };
    };

    const greeting = getGreeting();

    const roleColors: Record<string, string> = {
        admin: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
        murabbi: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
        salik: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    };

    const roleBadgeText: Record<string, string> = {
        admin: 'Administrator',
        murabbi: 'Murabbi Mentor',
        salik: 'Salik Seeker',
    };

    const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

    const notifRoute = profile.role === 'salik' ? '/salik/notifications' : null;

    return (
        <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex items-center justify-between pl-14 lg:pl-4 
                       glass-panel premium-shadow rounded-2xl py-3 px-5 sm:px-6 
                       border border-border/40 w-full backdrop-blur-2xl"
        >
            {/* Left: Greeting */}
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground bg-clip-text flex gap-1.5 items-center">
                        {greeting.text} {greeting.icon}, {profile.full_name.split(' ')[0]}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                            variant="outline"
                            className={`rounded-full px-2.5 py-0 border drop-shadow-sm font-medium text-[10px] uppercase tracking-widest ${roleColors[profile.role]}`}
                        >
                            {roleBadgeText[profile.role]}
                        </Badge>
                    </div>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                {/* Date pill */}
                <div className="hidden sm:flex items-center gap-3 text-muted-foreground/80 bg-black/5 dark:bg-white/5 py-1.5 px-3.5 rounded-full border border-border/50">
                    <Calendar size={14} className="text-primary" />
                    <span className="text-xs font-medium tracking-wide">{today}</span>
                </div>

                {/* Notifications Bell */}
                <div className="relative" ref={bellRef}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "relative w-9 h-9 rounded-xl border border-border/40 bg-background/60 hover:bg-secondary/60",
                            unread > 0 && "border-primary/30"
                        )}
                        onClick={() => { setPanelOpen(o => !o); if (!panelOpen) fetchNotifications(); }}
                        aria-label="Notifications"
                    >
                        {unread > 0 ? (
                            <BellDot size={17} className="text-primary" />
                        ) : (
                            <Bell size={17} className="text-muted-foreground" />
                        )}
                        {unread > 0 && (
                            <span className="absolute -top-1 -right-1 w-4.5 h-4.5 min-w-[18px] px-1 text-[10px] font-bold bg-primary text-primary-foreground rounded-full flex items-center justify-center leading-none">
                                {unread > 9 ? '9+' : unread}
                            </span>
                        )}
                    </Button>

                    {/* Notifications Dropdown Panel */}
                    <AnimatePresence>
                        {panelOpen && (
                            <motion.div
                                key="notif-panel"
                                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                                transition={{ duration: 0.18 }}
                                className="absolute right-0 top-full mt-2 w-[340px] sm:w-[380px] bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden z-[100]"
                            >
                                {/* Panel Header */}
                                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20">
                                    <div className="flex items-center gap-2">
                                        <Bell size={15} className="text-primary" />
                                        <span className="font-semibold text-sm">Notifications</span>
                                        {unread > 0 && (
                                            <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">{unread}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {unread > 0 && (
                                            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1" onClick={markAllRead}>
                                                <Check size={12} />
                                                Mark all read
                                            </Button>
                                        )}
                                        {notifRoute && (
                                            <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={() => { setPanelOpen(false); router.push(notifRoute); }}>
                                                View all
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Notification List */}
                                <div className="max-h-[380px] overflow-y-auto">
                                    {loading ? (
                                        <div className="flex items-center justify-center py-10">
                                            <Loader2 size={20} className="animate-spin text-primary" />
                                        </div>
                                    ) : notifications.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                                            <Bell size={28} className="opacity-20" />
                                            <p className="text-sm font-medium">No notifications yet</p>
                                            <p className="text-xs opacity-60">You&apos;re all caught up! 🌙</p>
                                        </div>
                                    ) : (
                                        notifications.map((notif, i) => (
                                            <motion.div
                                                key={notif.id}
                                                initial={{ opacity: 0, x: 10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.03 }}
                                                className={cn(
                                                    "group flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer border-b border-border/20 last:border-0",
                                                    !notif.is_read && "bg-primary/3 dark:bg-primary/5"
                                                )}
                                                onClick={() => handleNotifClick(notif)}
                                            >
                                                {/* Icon */}
                                                <div className="w-9 h-9 rounded-xl bg-secondary/80 flex items-center justify-center flex-shrink-0 text-lg mt-0.5">
                                                    {NOTIF_ICONS[notif.type] || '🔔'}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className={cn("text-sm font-semibold leading-snug truncate", !notif.is_read ? "text-foreground" : "text-foreground/70")}>
                                                            {notif.title}
                                                        </p>
                                                        {!notif.is_read && (
                                                            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">{notif.message}</p>
                                                    <p className="text-[10px] text-muted-foreground/50 mt-1">
                                                        {new Date(notif.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} · {new Date(notif.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    </p>
                                                </div>

                                                {/* Dismiss */}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 hover:bg-red-50 rounded-lg flex-shrink-0 transition-opacity"
                                                    onClick={(e) => { e.stopPropagation(); dismissNotif(notif.id); }}
                                                >
                                                    <Trash2 size={12} />
                                                </Button>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.header>
    );
}
