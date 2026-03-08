// ════════════════════════════════════════════════════════════
// Salik – Notifications Page
// ════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Bell, Loader2, X } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Notification } from '@/types';
import { MdAccessAlarm, MdWarningAmber, MdAutoAwesome, MdPushPin, MdEmojiEvents, MdOutlineArticle, MdNotificationsActive, MdOutlineAnnouncement, MdInfoOutline } from 'react-icons/md';

export default function SalikNotificationsPage() {
    const { profile } = useAuth();
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        if (!profile) return;
        const fetchNotifications = async () => {
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', profile.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (data) setNotifications(data as Notification[]);
            setLoading(false);
        };
        fetchNotifications();
    }, [profile, supabase]);

    const markReadAndNavigate = async (notif: Notification) => {
        if (!notif.is_read) {
            await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
            setNotifications((prev) =>
                prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
            );
        }
        if (notif.action_url) {
            router.push(notif.action_url);
        }
    };

    const markAllRead = async () => {
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length === 0) return;

        await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    };

    const dismissNotification = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        await supabase.from('notifications').delete().eq('id', id);
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'reminder': return <MdAccessAlarm className="text-blue-500 text-2xl mt-0.5 flex-shrink-0" />;
            case 'alert': return <MdWarningAmber className="text-amber-500 text-2xl mt-0.5 flex-shrink-0" />;
            case 'motivational': return <MdAutoAwesome className="text-purple-500 text-2xl mt-0.5 flex-shrink-0" />;
            case 'achievement': return <MdEmojiEvents className="text-yellow-500 text-2xl mt-0.5 flex-shrink-0" />;
            case 'summary': return <MdOutlineArticle className="text-indigo-500 text-2xl mt-0.5 flex-shrink-0" />;
            case 'action': return <MdNotificationsActive className="text-emerald-500 text-2xl mt-0.5 flex-shrink-0" />;
            case 'broadcast': return <MdOutlineAnnouncement className="text-rose-500 text-2xl mt-0.5 flex-shrink-0" />;
            case 'info': return <MdInfoOutline className="text-blue-400 text-2xl mt-0.5 flex-shrink-0" />;
            default: return <MdPushPin className="text-muted-foreground text-2xl mt-0.5 flex-shrink-0" />;
        }
    };

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Notifications</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Stay updated on your spiritual journey</p>
                </div>
                {notifications.some(n => !n.is_read) && (
                    <Button variant="outline" size="sm" onClick={markAllRead}>
                        Mark all read
                    </Button>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : notifications.length === 0 ? (
                <Card className="border-0 shadow-sm bg-card/50">
                    <CardContent className="text-center py-16 text-muted-foreground flex flex-col items-center">
                        <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mb-4">
                            <Bell size={32} className="opacity-40" />
                        </div>
                        <p className="font-semibold text-lg text-foreground">No Notifications</p>
                        <p className="text-sm mt-1">You are all caught up!</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {notifications.map((notif, i) => (
                        <motion.div
                            key={notif.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                        >
                            <Card
                                onClick={() => markReadAndNavigate(notif)}
                                className={`border shadow-sm transition-all hover:shadow-md cursor-pointer relative group overflow-hidden ${notif.is_read ? 'opacity-70 bg-muted/20 border-border/50' : 'bg-card border-border'
                                    }`}
                            >
                                {!notif.is_read && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                                )}
                                <CardContent className="p-4 flex items-start gap-4">
                                    <div className="bg-muted p-2 rounded-full hidden sm:block">
                                        {getIcon(notif.type)}
                                    </div>
                                    <div className="block sm:hidden flex-shrink-0">
                                        {getIcon(notif.type)}
                                    </div>
                                    <div className="flex-1 min-w-0 pr-8">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className={`text-sm tracking-tight ${notif.is_read ? 'font-medium' : 'font-bold'}`}>{notif.title}</p>
                                            {!notif.is_read && (
                                                <Badge variant="default" className="text-[10px] px-1.5 py-0">New</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground leading-relaxed">{notif.message}</p>
                                        <p className="text-[11px] text-muted-foreground/60 mt-2 font-medium">
                                            {new Date(notif.created_at).toLocaleString(undefined, {
                                                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => dismissNotification(e, notif.id)}
                                        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    >
                                        <X size={16} />
                                    </Button>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
