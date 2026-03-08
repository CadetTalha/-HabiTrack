// ════════════════════════════════════════════════════════════
// Murabbi Dashboard – Mentor Overview
// ════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState, useCallback } from 'react';
import { StatsCard } from '@/components/shared/StatsCard';
import { PerformanceChart } from '@/components/shared/PerformanceChart';
import { PerformanceRing } from '@/components/shared/PerformanceRing';
import { InviteUserModal } from '@/components/shared/InviteUserModal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Users, AlertTriangle, TrendingDown, CheckSquare, ArrowRight, AlertCircle, Loader2, BookOpen, Heart, Send, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import Link from 'next/link';
import type { Profile, MurabbiStats } from '@/types';

interface EnrichedSalik extends Profile {
    latest_pct: number;
    submitted_today: boolean;
    chilla_day: number;
}

export default function MurabbiDashboard() {
    const { profile } = useAuth();
    const [stats, setStats] = useState<MurabbiStats>({
        assignedSaliks: 0,
        nonSubmitted: 0,
        lowPerformance: 0,
        submittedToday: 0,
    });
    const [saliks, setSaliks] = useState<EnrichedSalik[]>([]);
    const [trendData, setTrendData] = useState<{ date: string; percentage: number }[]>([]);
    const [avgPerformance, setAvgPerformance] = useState(0);
    const [loading, setLoading] = useState(true);

    // Encouragement modal state
    const [encourageTarget, setEncourageTarget] = useState<EnrichedSalik | null>(null);
    const [encourageMsg, setEncourageMsg] = useState('');
    const [sendingEncourage, setSendingEncourage] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);

    const supabase = createClient();

    const fetchData = useCallback(async () => {
        if (!profile) return;
        setLoading(true);

        const { data: mappings } = await supabase
            .from('salik_murabbi_map')
            .select('salik_id, salik:profiles!salik_murabbi_map_salik_id_fkey(*)')
            .eq('murabbi_id', profile.id)
            .eq('is_active', true);

        const salikProfiles = mappings?.map((m) => m.salik as unknown as Profile) || [];
        const salikIds = salikProfiles.map(s => s.id);
        const today = new Date().toISOString().split('T')[0];

        let nonSubmitted = 0;
        let lowPerf = 0;
        let submittedToday = 0;
        const enrichedSaliks: EnrichedSalik[] = [];

        for (const salik of salikProfiles) {
            // Today's report
            const { data: todayReport } = await supabase
                .from('daily_reports')
                .select('completion_percentage')
                .eq('salik_id', salik.id)
                .eq('report_date', today)
                .single();

            const submitted = !!todayReport;
            if (!submitted) nonSubmitted++;
            else submittedToday++;

            // 7-day avg
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const { data: recentReports } = await supabase
                .from('daily_reports')
                .select('completion_percentage')
                .eq('salik_id', salik.id)
                .gte('report_date', sevenDaysAgo.toISOString().split('T')[0]);

            const avg = recentReports && recentReports.length > 0
                ? recentReports.reduce((a, b) => a + Number(b.completion_percentage), 0) / recentReports.length
                : 0;

            if (avg < 65 && recentReports && recentReports.length > 0) lowPerf++;

            // Real Chilla day from chilla_records
            const { data: activeChilla } = await supabase
                .from('chilla_records')
                .select('start_date')
                .eq('salik_id', salik.id)
                .eq('is_complete', false)
                .single();

            let chillaDay = 0;
            if (activeChilla) {
                const startDate = new Date(activeChilla.start_date);
                const now = new Date();
                startDate.setHours(0, 0, 0, 0);
                now.setHours(0, 0, 0, 0);
                const diff = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                chillaDay = Math.min(Math.max(diff, 1), 40);
            }

            enrichedSaliks.push({ ...salik, latest_pct: Math.round(avg), submitted_today: submitted, chilla_day: chillaDay });
        }

        setSaliks(enrichedSaliks);
        setStats({ assignedSaliks: salikIds.length, nonSubmitted, lowPerformance: lowPerf, submittedToday });

        // 14-day trend
        const days: { date: string; percentage: number }[] = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const { data: dayReports } = await supabase
                .from('daily_reports')
                .select('completion_percentage')
                .in('salik_id', salikIds.length > 0 ? salikIds : ['none'])
                .eq('report_date', dateStr);

            const dayAvg = dayReports && dayReports.length > 0
                ? dayReports.reduce((a, b) => a + Number(b.completion_percentage), 0) / dayReports.length
                : 0;
            days.push({ date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), percentage: Math.round(dayAvg) });
        }
        setTrendData(days);
        const activeDays = days.filter(d => d.percentage > 0);
        setAvgPerformance(activeDays.length > 0 ? Math.round(activeDays.reduce((a, b) => a + b.percentage, 0) / activeDays.length) : 0);
        setLoading(false);
    }, [profile, supabase]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const openEncourage = (salik: EnrichedSalik) => {
        setEncourageTarget(salik);
        setEncourageMsg(`Assalamu Alaikum ${salik.full_name}! 🌙 I noticed your consistency has been a bit low this week. I believe in your ability to make these 40 days count — take it one habit at a time. You've got this, insha'Allah! 💪`);
    };

    const sendEncouragement = async () => {
        if (!encourageTarget || !profile) return;
        setSendingEncourage(true);
        try {
            const res = await fetch('/api/notifications/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: encourageTarget.id,
                    type: 'motivational',
                    title: `A message from your Murrabi 🌙`,
                    message: encourageMsg,
                    action_url: '/salik',
                }),
            });
            if (!res.ok) throw new Error();
            toast.success(`Encouragement sent to ${encourageTarget.full_name}! JazakAllah Khair.`);
            setEncourageTarget(null);
        } catch {
            toast.error('Failed to send encouragement. Please try again.');
        } finally {
            setSendingEncourage(false);
        }
    };

    const needsAttentionSaliks = saliks.filter(s => s.latest_pct < 65 && s.latest_pct > 0);

    const getBadgeVariant = (pct: number) => {
        if (pct >= 65) return 'default';
        if (pct >= 50) return 'secondary';
        return 'destructive';
    };

    if (loading) {
        return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-5 sm:space-y-6">
            {/* Welcome Banner */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-2xl bg-card/40 backdrop-blur-xl p-6 sm:p-8 border border-white/20 dark:border-white/5 premium-shadow"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-transparent opacity-50 pointer-events-none" />
                <div className="relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                            <Avatar className="w-16 h-16 border-2 border-blue-500/20 shadow-xl">
                                <AvatarImage src={profile?.avatar_url} />
                                <AvatarFallback className="bg-blue-500/10 text-blue-600 font-bold">
                                    {profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Heart size={18} className="text-blue-500 animate-pulse" />
                                    <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">Mentor Dashboard</span>
                                </div>
                                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                                    Murabbi Overview{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''} 🕌
                                </h1>
                                <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-xl leading-relaxed">
                                    &quot;The best among you are those who learn the Qur&apos;an and teach it.&quot;
                                    <br /><span className="text-xs opacity-70 italic">— Guide your Saliks with Ihsan (excellence).</span>
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-2 sm:mt-0">
                            <Link href="/murabbi/templates">
                                <Button variant="outline" className="gap-2 rounded-xl bg-white/5 backdrop-blur-md hover:bg-white/10 border-white/10 shadow-sm">
                                    <BookOpen size={16} />
                                    Templates
                                </Button>
                            </Link>
                            <Button className="gap-2 rounded-xl shadow-sm" onClick={() => setShowInviteModal(true)}>
                                <UserPlus size={16} />
                                Add Salik
                            </Button>
                            <InviteUserModal
                                open={showInviteModal}
                                onOpenChange={setShowInviteModal}
                                defaultRole="salik"
                                murabbiId={profile?.id}
                                onSuccess={() => setShowInviteModal(false)}
                            />
                        </div>
                    </div>
                </div>
                <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none translate-x-1/4 -translate-y-1/4" />
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatsCard title="Assigned Saliks" value={stats.assignedSaliks} subtitle="Under your guidance" icon={Users} index={0} />
                <StatsCard title="Pending Today" value={stats.nonSubmitted} subtitle="Not submitted today" icon={AlertTriangle} index={1} />
                <StatsCard title="Needs Attention" value={stats.lowPerformance} subtitle="Below 65% — needs your help" icon={TrendingDown} index={2} />
                <StatsCard
                    title="Submitted Today"
                    value={`${stats.submittedToday} / ${stats.assignedSaliks}`}
                    subtitle="Reports received today"
                    icon={CheckSquare}
                    index={3}
                />
            </div>

            {/* Chart + Ring */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="lg:col-span-2">
                    <PerformanceChart data={trendData} title="Group Amal Trend (14 Days)" />
                </div>
                <Card className="border border-white/20 dark:border-white/5 premium-shadow glass-panel bg-card/40">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold">Group Health</CardTitle>
                        <CardDescription className="text-xs">Collective spiritual progress</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center py-4">
                        <PerformanceRing percentage={avgPerformance} size={140} label="Group Average" sublabel="All assigned Saliks" />
                    </CardContent>
                </Card>
            </div>

            {/* ⚠️ Needs Attention Panel */}
            {needsAttentionSaliks.length > 0 && (
                <Card className="border border-amber-300/30 dark:border-amber-500/20 shadow-sm bg-amber-50/30 dark:bg-amber-500/5">
                    <CardHeader className="pb-3 border-b border-amber-200/30">
                        <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                            <AlertTriangle size={18} />
                            ⚠️ Needs Your Attention
                        </CardTitle>
                        <CardDescription className="text-xs">These Saliks are below the 65% consistency threshold.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                        {needsAttentionSaliks.map((salik) => (
                            <div key={salik.id} className="flex items-center justify-between gap-3 p-3 bg-background/60 rounded-xl border border-border/40">
                                <div className="flex items-center gap-3">
                                    <Avatar className="w-9 h-9">
                                        <AvatarFallback className="bg-amber-100 text-amber-700 text-sm font-bold">{salik.full_name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold text-sm">{salik.full_name}</p>
                                        <p className="text-xs text-muted-foreground">7-day avg: <span className="font-bold text-red-500">{salik.latest_pct}%</span></p>
                                    </div>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => openEncourage(salik)} className="gap-1.5 text-xs border-amber-300 text-amber-700 hover:bg-amber-50">
                                    <Send size={12} />
                                    Send Encouragement
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Saliks Grid */}
            <Card className="border border-white/20 dark:border-white/5 premium-shadow glass-panel bg-card/40">
                <CardHeader className="pb-3 border-b border-border/40">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Users size={18} className="text-primary" />
                                My Saliks
                            </CardTitle>
                            <CardDescription className="text-xs mt-0.5">Seekers under your mentorship</CardDescription>
                        </div>
                        <Link href="/murabbi/saliks">
                            <Badge variant="outline" className="cursor-pointer hover:bg-secondary/50 text-xs backdrop-blur-sm bg-white/5 border-white/10">
                                View Details →
                            </Badge>
                        </Link>
                    </div>
                </CardHeader>
                <CardContent className="pt-4">
                    {saliks.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground bg-black/5 dark:bg-white/5 rounded-xl border border-border/40">
                            <AlertCircle size={32} className="mx-auto mb-3 opacity-40 text-primary" />
                            <p className="text-sm font-medium mb-1">No Saliks assigned yet</p>
                            <p className="text-xs text-muted-foreground/70">Your Saliks will appear here once they complete their profile after receiving your invite. 🌙</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                            {saliks.map((salik, i) => (
                                <motion.div
                                    key={salik.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                >
                                    <Link href={`/murabbi/saliks?id=${salik.id}`}>
                                        <div className="flex items-center gap-3 p-3.5 rounded-xl hover:bg-white/40 dark:hover:bg-black/20 transition-all group cursor-pointer border border-border/40 hover:border-border hover:shadow-md bg-white/20 dark:bg-white/5 backdrop-blur-md relative">
                                            {/* Status dot */}
                                            <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 border-background ${salik.submitted_today ? 'bg-emerald-500' : 'bg-amber-400'}`}
                                                title={salik.submitted_today ? 'Submitted today ✅' : 'Pending ⏰'} />

                                            <Avatar className="w-10 h-10 sm:w-11 sm:h-11 shadow-sm border border-white/20">
                                                <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-white text-sm font-bold">
                                                    {salik.full_name.charAt(0)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold truncate text-foreground">{salik.full_name}</p>
                                                {salik.chilla_day > 0 ? (
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">Day {salik.chilla_day} of 40</p>
                                                ) : (
                                                    <p className="text-[10px] text-muted-foreground mt-0.5 italic">No active Chilla</p>
                                                )}
                                                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                    7-day avg: <span className="font-medium text-foreground/80">{salik.latest_pct}%</span>
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant={getBadgeVariant(salik.latest_pct)}
                                                    className="text-[10px] sm:text-xs shadow-sm"
                                                >
                                                    {salik.latest_pct}%
                                                </Badge>
                                                <ArrowRight size={14} className="text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all hidden sm:block" />
                                            </div>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Send Encouragement Modal */}
            <Dialog open={!!encourageTarget} onOpenChange={(o) => !o && setEncourageTarget(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Send Encouragement 🌙</DialogTitle>
                        <DialogDescription>
                            Your message will be sent as a notification to {encourageTarget?.full_name}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Textarea
                            value={encourageMsg}
                            onChange={(e) => setEncourageMsg(e.target.value.slice(0, 500))}
                            rows={6}
                            className="resize-none"
                            placeholder="Write a warm, encouraging message..."
                        />
                        <p className="text-xs text-muted-foreground text-right">{encourageMsg.length}/500</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEncourageTarget(null)}>Cancel</Button>
                        <Button onClick={sendEncouragement} disabled={sendingEncourage || !encourageMsg.trim()} className="gap-2">
                            {sendingEncourage ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            Send
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
