// ════════════════════════════════════════════════════════════
// Admin Dashboard – Ummah-Wide Overview
// ════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import { StatsCard } from '@/components/shared/StatsCard';
import { ActivityFeed } from '@/components/shared/ActivityFeed';
import { PerformanceChart } from '@/components/shared/PerformanceChart';
import { PerformanceRing } from '@/components/shared/PerformanceRing';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, AlertTriangle, TrendingUp, ArrowRight, Shield, BookOpen, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import type { ActivityLog, AdminStats } from '@/types';
import { InviteUserModal } from '@/components/shared/InviteUserModal';
import { AdminBroadcastModal } from '@/components/shared/AdminBroadcastModal';
import { MurrabisDirectory } from './components/MurrabisDirectory';
import { SaliksDirectory } from './components/SaliksDirectory';

export default function AdminDashboard() {
    const { profile } = useAuth();
    const [stats, setStats] = useState<AdminStats>({
        totalSaliks: 0,
        activeChillas: 0,
        missedReports: 0,
        averagePerformance: 0,
        pendingInvites: 0,
    });
    const [totalMurabbis, setTotalMurabbis] = useState(0);
    const [pendingInviteUsers, setPendingInviteUsers] = useState<any[]>([]);
    const [murabbisDirectory, setMurabbisDirectory] = useState<any[]>([]);
    const [saliksDirectory, setSaliksDirectory] = useState<any[]>([]);
    const [activities, setActivities] = useState<ActivityLog[]>([]);
    const [trendData, setTrendData] = useState<{ date: string; percentage: number }[]>([]);
    const supabase = createClient();
    const [showCreateUser, setShowCreateUser] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            // Total Saliks
            const { count: salikCount } = await supabase
                .from('profiles')
                .select('id', { count: 'exact' })
                .eq('role', 'salik');

            // Total Murabbis
            const { count: murabbiCount } = await supabase
                .from('profiles')
                .select('id', { count: 'exact' })
                .eq('role', 'murabbi');

            // Pending Invites
            const { data: pendingUsers, count: pendingCount } = await supabase
                .from('profiles')
                .select('id, full_name, email, role, created_at', { count: 'exact' })
                .eq('is_profile_complete', false)
                .order('created_at', { ascending: false });

            setPendingInviteUsers(pendingUsers || []);

            // Active Chillas
            const { count: activeChillasCount } = await supabase
                .from('chilla_records')
                .select('id', { count: 'exact' })
                .eq('is_complete', false);

            setTotalMurabbis(murabbiCount || 0);

            const today = new Date().toISOString().split('T')[0];

            // Missed reports today
            const { count: submittedToday } = await supabase
                .from('daily_reports')
                .select('id', { count: 'exact' })
                .eq('report_date', today);

            const missedReports = (salikCount || 0) - (submittedToday || 0);

            // Average performance (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const { data: recentReports } = await supabase
                .from('daily_reports')
                .select('completion_percentage')
                .gte('report_date', thirtyDaysAgo.toISOString().split('T')[0]);

            const avgPerf =
                recentReports && recentReports.length > 0
                    ? recentReports.reduce((a, b) => a + Number(b.completion_percentage), 0) /
                    recentReports.length
                    : 0;

            setStats({
                totalSaliks: salikCount || 0,
                activeChillas: activeChillasCount || 0,
                missedReports: Math.max(0, missedReports),
                averagePerformance: Math.round(avgPerf),
                pendingInvites: pendingCount || 0,
            });

            // Activity logs
            const { data: logs } = await supabase
                .from('activity_logs')
                .select('*, user:profiles(full_name)')
                .order('created_at', { ascending: false })
                .limit(10);

            if (logs) setActivities(logs as unknown as ActivityLog[]);

            // Trend data (last 14 days)
            const trendDays: { date: string; percentage: number }[] = [];
            for (let i = 13; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                const { data: dayReports } = await supabase
                    .from('daily_reports')
                    .select('completion_percentage')
                    .eq('report_date', dateStr);

                const avg =
                    dayReports && dayReports.length > 0
                        ? dayReports.reduce((a, b) => a + Number(b.completion_percentage), 0) /
                        dayReports.length
                        : 0;

                trendDays.push({
                    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    percentage: Math.round(avg),
                });
            }
            setTrendData(trendDays);
        };

        fetchData();
    }, [supabase]);

    return (
        <div className="space-y-6">
            {/* Welcome Banner */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-2xl bg-card/40 backdrop-blur-xl p-6 sm:p-8 border border-white/20 dark:border-white/5 premium-shadow"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent opacity-50 pointer-events-none" />
                <div className="relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                            <Avatar className="w-16 h-16 border-2 border-primary/20 shadow-xl">
                                <AvatarImage src={profile?.avatar_url} />
                                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                    {profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Shield size={18} className="text-primary animate-pulse" />
                                    <span className="text-xs font-bold text-primary uppercase tracking-widest">Admin Overview</span>
                                </div>
                                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                                    System Administration
                                </h1>
                                <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-xl leading-relaxed">
                                    &quot;Whoever guides someone to goodness will have a reward like that of the one who did it.&quot;
                                    <br /><span className="text-xs opacity-70 italic">— Sahih Muslim</span>
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <AdminBroadcastModal />
                            <Button onClick={() => setShowCreateUser(true)} className="gap-2 rounded-xl">
                                <Users size={16} /> Add User
                            </Button>
                            <InviteUserModal
                                open={showCreateUser}
                                onOpenChange={setShowCreateUser}
                                onSuccess={() => { setShowCreateUser(false); }}
                            />
                        </div>
                    </div>
                </div>
                <div className="absolute right-0 top-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none translate-x-1/4 -translate-y-1/4" />
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                <StatsCard
                    title="Total Saliks"
                    value={stats.totalSaliks}
                    subtitle="Active seekers"
                    icon={Users}
                    index={0}
                />
                <StatsCard
                    title="Total Murabbis"
                    value={totalMurabbis}
                    subtitle="Active mentors"
                    icon={BookOpen}
                    index={1}
                />
                <StatsCard
                    title="Pending Reports"
                    value={stats.missedReports}
                    subtitle="Not submitted today"
                    icon={AlertTriangle}
                    index={2}
                />
                <StatsCard
                    title="Avg Performance"
                    value={`${stats.averagePerformance}%`}
                    subtitle="Last 30 days"
                    icon={TrendingUp}
                    index={3}
                />
                <StatsCard
                    title="Total Group"
                    value={(stats.totalSaliks || 0) + (totalMurabbis || 0)}
                    subtitle="Saliks + Murabbis"
                    icon={Clock}
                    index={4}
                />
            </div>

            {/* Charts & Health */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="lg:col-span-2">
                    <PerformanceChart data={trendData} title="Ummah Performance Trend (14 Days)" />
                </div>
                <Card className="border border-white/20 dark:border-white/5 premium-shadow glass-panel bg-card/40">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold">Community Health</CardTitle>
                        <CardDescription className="text-xs">Overall spiritual progress</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center py-4">
                        <PerformanceRing
                            percentage={stats.averagePerformance}
                            size={140}
                            label="System Average"
                            sublabel="All Saliks combined"
                        />
                    </CardContent>
                </Card>
            </div>

            {/* Activity & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="lg:col-span-2">
                    <ActivityFeed activities={activities} />
                </div>
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                >
                    <Card className="border border-white/20 dark:border-white/5 premium-shadow glass-panel bg-card/40">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5">
                            {[
                                { label: 'Murrabi Directory', href: '/admin/murabbis', badge: 'Mentors', desc: 'Add or manage mentors' },
                                { label: 'Salik Directory', href: '/admin/saliks', badge: 'Seekers', desc: 'Reassign or view students' },
                                { label: 'View Analytics', href: '/admin/analytics', badge: 'Insights', desc: 'Performance analytics' },
                                { label: 'Activity Logs', href: '/admin/logs', badge: 'History', desc: 'System activity timeline' },
                                { label: 'System Configuration', href: '/admin/settings', badge: 'Settings', desc: 'Alerts and cron times' }
                            ].map((action) => (
                                <Link key={action.href} href={action.href}>
                                    <div className="flex items-center justify-between p-3 rounded-xl hover:bg-secondary/60 transition-all group cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            <Badge variant="secondary" className="text-[10px] px-2">
                                                {action.badge}
                                            </Badge>
                                            <div>
                                                <span className="text-sm font-medium">{action.label}</span>
                                                <p className="text-[11px] text-muted-foreground">{action.desc}</p>
                                            </div>
                                        </div>
                                        <ArrowRight
                                            size={14}
                                            className="text-muted-foreground group-hover:translate-x-1 transition-transform flex-shrink-0"
                                        />
                                    </div>
                                </Link>
                            ))}
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Directories */}
            <MurrabisDirectory />
            <SaliksDirectory />
        </div>
    );
}
