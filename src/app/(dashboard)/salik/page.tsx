// ════════════════════════════════════════════════════════════
// Salik Dashboard – Embedded Daily Checklist & Progress
// ════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import { StatsCard } from '@/components/shared/StatsCard';
import { PerformanceChart } from '@/components/shared/PerformanceChart';
import { PerformanceRing } from '@/components/shared/PerformanceRing';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { calculateStreak, calculate40DayAverage } from '@/lib/services/performance';
import { HABIT_CATEGORIES, type HabitTemplate } from '@/types';
import { Target, Flame, TrendingUp, Calendar, CheckCircle2, XCircle, Send, Loader2, BookOpen, AlertCircle, Clock, ArrowRight, MessageCircle, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { toast } from 'sonner';
import { ChillaCounter } from '@/components/salik/ChillaCounter';
import { MyMurrabiCard } from '@/components/salik/MyMurrabiCard';

interface TaskItem {
    assignmentId: string;
    template: HabitTemplate;
    status: 'completed' | 'missed' | 'unanswered';
    inputValue?: string | number;
}

export default function SalikDashboard() {
    const { profile } = useAuth();

    // Stats State
    const [todayCompletion, setTodayCompletion] = useState(0);
    const [currentStreak, setCurrentStreak] = useState(0);
    const [fortyDayAvg, setFortyDayAvg] = useState(0);
    const [totalReports, setTotalReports] = useState(0);
    const [trendData, setTrendData] = useState<{ date: string; percentage: number }[]>([]);

    // Loading & Report Status
    const [loading, setLoading] = useState(true);
    const [existingReportId, setExistingReportId] = useState<string | null>(null);

    const supabase = createClient();
    const todayStr = new Date().toISOString().split('T')[0];

    useEffect(() => {
        if (!profile) return;

        const fetchData = async () => {
            // 1. Fetch Stats
            const { data: allReports } = await supabase
                .from('daily_reports')
                .select('completion_percentage, report_date')
                .eq('salik_id', profile.id)
                .order('report_date', { ascending: true });

            if (allReports && allReports.length > 0) {
                setTotalReports(allReports.length);
                const dates = allReports.map((r) => r.report_date);
                setCurrentStreak(calculateStreak(dates));
                const percentages = allReports.map((r) => Number(r.completion_percentage));
                setFortyDayAvg(calculate40DayAverage(percentages));
            }

            const days: { date: string; percentage: number }[] = [];
            for (let i = 13; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                const r = allReports?.find(x => x.report_date === dateStr);
                days.push({
                    date: d.toLocaleDateString('en-US', { weekday: 'short' }),
                    percentage: r ? Number(r.completion_percentage) : 0,
                });
            }
            setTrendData(days);

            // 2. Check for Today's Report
            const { data: todayReport } = await supabase
                .from('daily_reports')
                .select('id, completion_percentage')
                .eq('salik_id', profile.id)
                .eq('report_date', todayStr)
                .single();

            if (todayReport) {
                setTodayCompletion(Number(todayReport.completion_percentage));
                setExistingReportId(todayReport.id);
            }
            setLoading(false);
        };

        fetchData();
    }, [profile, supabase, todayStr]);

    const isSubmitted = !!existingReportId;

    // Ring sublabel logic
    const getCurrentHour = () => new Date().getHours();
    const getRingLabels = () => {
        if (isSubmitted) return { label: 'Daily Amal', sublabel: 'JazakAllah Khair! ✓' };
        if (getCurrentHour() >= 22) return { label: 'Missed today', sublabel: 'Tomorrow is a new day 💙' };
        return { label: 'Not submitted', sublabel: 'Submit your report' };
    };
    const ringLabels = getRingLabels();

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">

            {/* ── Banner ── */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-2xl bg-card/40 backdrop-blur-xl p-6 sm:p-8 border border-white/20 dark:border-white/5 premium-shadow"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent opacity-50 pointer-events-none" />
                <div className="relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                        <Avatar className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-primary/20 shadow-2xl">
                            <AvatarImage src={profile?.avatar_url} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                                {profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Spiritual Journey</p>
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                                Assalamu Alaikum{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''} 🌙
                            </h1>
                            <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-xl leading-relaxed italic">
                                "Indeed, with hardship comes ease."
                                <br /><span className="text-xs opacity-70 not-italic">— Quran 94:6</span>
                            </p>
                        </div>
                    </div>
                </div>
                <div className="absolute right-0 top-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none translate-x-1/4 -translate-y-1/4" />
            </motion.div>

            {/* ── Status Banner (CTA) ── */}
            {!isSubmitted && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600">
                            <AlertCircle size={28} />
                        </div>
                        <div>
                            <h3 className="font-bold text-amber-900 dark:text-amber-200">Submit Your Daily Amal</h3>
                            <p className="text-sm text-amber-800/70 dark:text-amber-300/70">You haven't submitted your report for today yet.</p>
                        </div>
                    </div>
                    <Link href="/salik/report">
                        <Button className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl gap-2 font-semibold">
                            Complete Checklist <ArrowRight size={18} />
                        </Button>
                    </Link>
                </motion.div>
            )}

            {isSubmitted && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                            <CheckCircle2 size={28} />
                        </div>
                        <div>
                            <h3 className="font-bold text-emerald-900 dark:text-emerald-200">Daily Amal Logged</h3>
                            <p className="text-sm text-emerald-800/70 dark:text-emerald-300/70">MashaAllah! You have completed your spiritual audit for today.</p>
                        </div>
                    </div>
                    <Link href="/salik/report">
                        <Button variant="outline" className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 rounded-xl gap-2 font-semibold">
                            View/Edit Report <ArrowRight size={18} />
                        </Button>
                    </Link>
                </motion.div>
            )}

            {/* ── Stats Grid ── */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                <StatsCard
                    title="Today's Amal"
                    value={`${todayCompletion}%`}
                    subtitle={isSubmitted ? 'Report Logged ✓' : 'Awaiting submission'}
                    icon={Target}
                    index={0}
                />
                <StatsCard
                    title="Current Streak"
                    value={`${currentStreak}`}
                    subtitle={currentStreak > 0 ? `${currentStreak} days — MashaAllah!` : 'Start your streak today'}
                    icon={Flame}
                    index={1}
                />
                <StatsCard
                    title="Chilla Average"
                    value={`${fortyDayAvg}%`}
                    subtitle="Current Chilla avg"
                    icon={TrendingUp}
                    index={2}
                />
                <StatsCard
                    title="Total Submissions"
                    value={totalReports}
                    subtitle="All-time reports"
                    icon={Calendar}
                    index={3}
                />
            </div>

            {/* ── Chilla Counter ── */}
            <ChillaCounter />

            {/* ── Main Grid ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Left side: Trend Chart */}
                <div className="xl:col-span-2">
                    <PerformanceChart data={trendData} title="14-Day Performance Trend" height={350} />
                </div>

                {/* Right Column: Ring & Actions */}
                <div className="space-y-6">
                    {/* Performance Ring */}
                    <Card className="border border-white/20 dark:border-white/5 shadow-sm glass-panel bg-card/40">
                        <CardContent className="flex flex-col items-center py-6">
                            <PerformanceRing
                                percentage={todayCompletion}
                                size={140}
                                label={ringLabels.label}
                                sublabel={ringLabels.sublabel}
                            />
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card className="border border-white/20 dark:border-white/5 shadow-sm glass-panel bg-card/40">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5">
                            {[
                                { label: 'Daily Amal', href: '/salik/report', icon: BookOpen, desc: 'Complete your checklist' },
                                { label: 'View Progress', href: '/salik/progress', icon: Target, desc: '40-day Chilla overview' },
                                { label: 'Report History', href: '/salik/history', icon: History, desc: 'View past submissions' },
                                { label: 'HabiGuide AI', href: '/salik/chat', icon: MessageCircle, desc: 'Your spiritual companion' },
                            ].map((action) => (
                                <Link key={action.href} href={action.href}>
                                    <div className="flex items-center justify-between p-3 rounded-xl hover:bg-secondary/60 transition-all group cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <action.icon size={14} className="text-primary" />
                                            </div>
                                            <div>
                                                <span className="text-sm font-medium">{action.label}</span>
                                                <p className="text-[11px] text-muted-foreground">{action.desc}</p>
                                            </div>
                                        </div>
                                        <ArrowRight size={14} className="text-muted-foreground group-hover:translate-x-1 transition-transform flex-shrink-0" />
                                    </div>
                                </Link>
                            ))}
                        </CardContent>
                    </Card>

                    {/* My Murrabi */}
                    <MyMurrabiCard />
                </div>
            </div>
        </div>
    );
}

