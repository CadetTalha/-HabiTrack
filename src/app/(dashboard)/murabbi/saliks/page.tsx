// ════════════════════════════════════════════════════════════
// Murabbi – My Saliks Page (Detailed View)
// ════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PerformanceChart } from '@/components/shared/PerformanceChart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import { Users, Loader2, Calendar, Target, Flame, Send, CheckCircle2, XCircle, Search, Settings2, FileText, AlertTriangle, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Profile, DailyReport, ReportItem } from '@/types';
import { calculateStreak } from '@/lib/services/performance';
import { HABIT_CATEGORIES } from '@/types';
import { toast } from 'sonner';
import Link from 'next/link';

interface EnrichedSalik extends Profile {
    avgPerf: number;
    streak: number;
    submissions: number;
    todaysStatus: string;
    chillaDay: number;
}

interface CategoryStat {
    category: string;
    label: string;
    completedCount: number;
    totalCount: number;
    rate: number;
}

export default function MySaliksPage() {
    const { profile } = useAuth();
    const [saliks, setSaliks] = useState<EnrichedSalik[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSalik, setSelectedSalik] = useState<string | null>(null);
    const [salikTrend, setSalikTrend] = useState<{ date: string; percentage: number }[]>([]);
    const [todaysReport, setTodaysReport] = useState<(DailyReport & { report_items: ReportItem[] }) | null>(null);
    const [murabbiNote, setMurabbiNote] = useState('');
    const [savingNote, setSavingNote] = useState(false);
    const [assignedHabits, setAssignedHabits] = useState<any[]>([]);
    const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);

    // Encouragement modal
    const [encourageOpen, setEncourageOpen] = useState(false);
    const [encourageMsg, setEncourageMsg] = useState('');
    const [sendingEncourage, setSendingEncourage] = useState(false);

    const supabase = createClient();
    const todayStr = new Date().toISOString().split('T')[0];

    const fetchSaliks = useCallback(async () => {
        if (!profile) return;
        const { data: mappings } = await supabase
            .from('salik_murabbi_map')
            .select('salik_id, salik:profiles!salik_murabbi_map_salik_id_fkey(*)')
            .eq('murabbi_id', profile.id)
            .eq('is_active', true);

        const enriched: EnrichedSalik[] = [];

        for (const mapping of mappings || []) {
            const salik = mapping.salik as unknown as Profile;

            const { data: reports } = await supabase
                .from('daily_reports')
                .select('completion_percentage, report_date')
                .eq('salik_id', salik.id)
                .order('report_date', { ascending: true });

            const avg = reports && reports.length > 0
                ? Math.round(reports.slice(-40).reduce((a, b) => a + Number(b.completion_percentage), 0) / Math.min(reports.length, 40))
                : 0;

            const streak = reports && reports.length > 0
                ? calculateStreak(reports.map(r => r.report_date))
                : 0;

            const todaysStatus = reports?.find(r => r.report_date === todayStr) ? 'Submitted ✅' : 'Not Yet ⏳';

            // Real Chilla Day from chilla_records
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

            enriched.push({ ...salik, avgPerf: avg, streak, submissions: reports?.length || 0, todaysStatus, chillaDay });
        }

        setSaliks(enriched);
        if (enriched.length > 0) setSelectedSalik(enriched[0].id);
        setLoading(false);
    }, [profile, supabase, todayStr]);

    useEffect(() => { fetchSaliks(); }, [fetchSaliks]);

    useEffect(() => {
        if (!selectedSalik) return;

        const fetchSalikDetails = async () => {
            // 40-day trend
            const days: { date: string; percentage: number }[] = [];
            for (let i = 39; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                const { data } = await supabase
                    .from('daily_reports')
                    .select('completion_percentage')
                    .eq('salik_id', selectedSalik)
                    .eq('report_date', dateStr)
                    .single();
                days.push({ date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), percentage: data ? Number(data.completion_percentage) : 0 });
            }
            setSalikTrend(days);

            // Today's Report
            const { data: tReport } = await supabase
                .from('daily_reports')
                .select('*, report_items(*, habit_template:habit_templates(*))')
                .eq('salik_id', selectedSalik)
                .eq('report_date', todayStr)
                .single();
            setTodaysReport(tReport as any);

            if (tReport) {
                const { data: notesDb } = await supabase
                    .from('murabbi_report_notes')
                    .select('note')
                    .eq('report_id', tReport.id)
                    .eq('murabbi_id', profile!.id)
                    .single();
                setMurabbiNote(notesDb?.note || '');
            } else {
                setMurabbiNote('');
            }

            // Assigned habits
            const { data: assigned } = await supabase
                .from('salik_habit_assignments')
                .select('id, is_active, habit_id, habit_templates(*)')
                .eq('salik_id', selectedSalik);
            setAssignedHabits(assigned || []);

            // Category breakdown — fetch report_items for active Chilla window
            const { data: activeChilla } = await supabase
                .from('chilla_records')
                .select('start_date, end_date')
                .eq('salik_id', selectedSalik)
                .eq('is_complete', false)
                .single();

            if (activeChilla) {
                const { data: reportIds } = await supabase
                    .from('daily_reports')
                    .select('id')
                    .eq('salik_id', selectedSalik)
                    .gte('report_date', activeChilla.start_date)
                    .lte('report_date', activeChilla.end_date);

                if (reportIds && reportIds.length > 0) {
                    const ids = reportIds.map(r => r.id);
                    const { data: items } = await supabase
                        .from('report_items')
                        .select('status, habit_template:habit_templates(category)')
                        .in('report_id', ids);

                    if (items) {
                        const catMap: Record<string, { completed: number; total: number }> = {};
                        items.forEach((item: any) => {
                            const cat = item.habit_template?.category || 'other';
                            if (!catMap[cat]) catMap[cat] = { completed: 0, total: 0 };
                            catMap[cat].total++;
                            if (item.status === 'completed') catMap[cat].completed++;
                        });

                        const stats: CategoryStat[] = Object.entries(catMap).map(([cat, s]) => {
                            const catInfo = HABIT_CATEGORIES.find(c => c.value === cat);
                            return {
                                category: cat,
                                label: catInfo?.label || cat,
                                completedCount: s.completed,
                                totalCount: s.total,
                                rate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
                            };
                        }).sort((a, b) => b.rate - a.rate);

                        setCategoryStats(stats);
                    }
                } else {
                    setCategoryStats([]);
                }
            } else {
                setCategoryStats([]);
            }
        };

        fetchSalikDetails();
    }, [selectedSalik, supabase, todayStr, profile]);

    const saveMurabbiNote = async () => {
        if (!todaysReport || !profile) return;
        setSavingNote(true);
        try {
            const { error } = await supabase.from('murabbi_report_notes').upsert({
                report_id: todaysReport.id,
                murabbi_id: profile.id,
                note: murabbiNote,
            }, { onConflict: 'report_id, murabbi_id' });
            if (error) throw error;
            toast.success('Feedback saved successfully');
        } catch {
            toast.error('Failed to save feedback');
        } finally {
            setSavingNote(false);
        }
    };

    const toggleSalikHabit = async (habitId: string, currentState: boolean) => {
        try {
            const res = await fetch('/api/habits/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ habit_id: habitId, salik_id: selectedSalik, action: 'toggle', is_active: !currentState }),
            });
            if (!res.ok) throw new Error();
            toast.success('Habit status updated for this Salik');
            setAssignedHabits(prev => prev.map(a => a.habit_id === habitId ? { ...a, is_active: !currentState } : a));
        } catch {
            toast.error('Failed to update habit');
        }
    };

    const openEncourage = () => {
        const salik = saliks.find(s => s.id === selectedSalik);
        if (!salik) return;
        setEncourageMsg(`Assalamu Alaikum ${salik.full_name}! 🌙 I wanted to reach out and encourage you on your Chilla journey. Keep going — consistency is key. You're doing great, insha'Allah! 💪`);
        setEncourageOpen(true);
    };

    const sendEncouragement = async () => {
        if (!selectedSalik || !profile) return;
        setSendingEncourage(true);
        try {
            const res = await fetch('/api/notifications/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: selectedSalik,
                    type: 'motivational',
                    title: 'A message from your Murrabi 🌙',
                    message: encourageMsg,
                    action_url: '/salik',
                }),
            });
            if (!res.ok) throw new Error();
            toast.success('Encouragement sent! JazakAllah Khair.');
            setEncourageOpen(false);
        } catch {
            toast.error('Failed to send encouragement.');
        } finally {
            setSendingEncourage(false);
        }
    };

    const currentSalik = saliks.find(s => s.id === selectedSalik);

    const getBadgeVariant = (pct: number) => {
        if (pct >= 65) return 'default';
        if (pct >= 50) return 'secondary';
        return 'destructive';
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-xl border shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Users className="text-primary" />
                        My Saliks Database
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Select a Salik to view their reports, trends, and customize their habits.</p>
                </div>
                <Link href="/murrabi/saliks/low-performance">
                    <Button variant="destructive" className="bg-rose-500 hover:bg-rose-600 gap-2 shadow-sm">
                        <AlertTriangle size={16} />
                        Low Performance Center
                    </Button>
                </Link>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : saliks.length === 0 ? (
                <Card className="border-0 shadow-sm">
                    <CardContent className="text-center py-12 text-muted-foreground">
                        <Search size={40} className="mx-auto mb-3 opacity-30" />
                        <p>No Saliks assigned yet.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Salik list sidebar */}
                    <div className="space-y-2 lg:h-[800px] overflow-y-auto pr-2">
                        {saliks.map((s, i) => (
                            <motion.div key={s.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                                <button
                                    onClick={() => setSelectedSalik(s.id)}
                                    className={`w-full flex flex-col gap-2 p-4 rounded-xl text-left transition-all border ${selectedSalik === s.id ? 'bg-primary/5 border-primary shadow-sm' : 'bg-card border-border hover:border-primary/50'}`}
                                >
                                    <div className="flex items-center gap-3 w-full">
                                        <Avatar className="w-10 h-10 border shadow-sm">
                                            <AvatarImage src={s.avatar_url} />
                                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{s.full_name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold truncate text-foreground">{s.full_name}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {s.chillaDay > 0 ? `Day ${s.chillaDay} of 40` : 'No active Chilla'}
                                            </p>
                                        </div>
                                        <Badge variant={getBadgeVariant(s.avgPerf)} className="text-[10px]">{s.avgPerf}%</Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Badge variant="outline" className={`justify-center text-[10px] py-0 ${s.todaysStatus.includes('✅') ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10' : 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-500/10'}`}>
                                            {s.todaysStatus}
                                        </Badge>
                                        <Badge variant="outline" className="justify-center text-[10px] py-0">
                                            🔥 {s.streak} day streak
                                        </Badge>
                                    </div>
                                </button>
                            </motion.div>
                        ))}
                    </div>

                    {/* Selected Salik details */}
                    <div className="lg:col-span-3">
                        {currentSalik && (
                            <div className="space-y-6">
                                {/* Detail Header with Send Encouragement */}
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="w-12 h-12 border-2 border-primary/20">
                                            <AvatarImage src={currentSalik.avatar_url} />
                                            <AvatarFallback className="bg-primary/10 text-primary font-bold">{currentSalik.full_name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h2 className="text-lg font-bold">{currentSalik.full_name}</h2>
                                            <p className="text-xs text-muted-foreground">
                                                {currentSalik.chillaDay > 0 ? `Day ${currentSalik.chillaDay} of 40` : 'No active Chilla 🌙'}
                                                {' · '}{currentSalik.todaysStatus}
                                            </p>
                                        </div>
                                    </div>
                                    <Button variant="outline" onClick={openEncourage} className="gap-2 text-sm">
                                        <Send size={14} />
                                        Send Encouragement
                                    </Button>
                                </div>

                                {/* Top Stats — 4 cards */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <Card className="border-0 shadow-sm overflow-hidden relative">
                                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
                                        <CardContent className="p-5 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                                <Target size={20} className="text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold">{currentSalik.avgPerf}%</p>
                                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Avg Perf</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="border-0 shadow-sm overflow-hidden relative">
                                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
                                        <CardContent className="p-5 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                                <Calendar size={20} className="text-emerald-600" />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold">{currentSalik.submissions}</p>
                                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Reports</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="border-0 shadow-sm overflow-hidden relative">
                                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />
                                        <CardContent className="p-5 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                                                <Flame size={20} className="text-orange-600" />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold">{currentSalik.streak}</p>
                                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Streak</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="border-0 shadow-sm overflow-hidden relative">
                                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
                                        <CardContent className="p-5 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                                                <Moon size={20} className="text-purple-600" />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold">{currentSalik.chillaDay > 0 ? `${currentSalik.chillaDay}` : '—'}</p>
                                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Chilla Day</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                <Tabs defaultValue="today" className="w-full">
                                    <TabsList className="grid w-full grid-cols-4 mb-6">
                                        <TabsTrigger value="today" className="gap-2"><FileText size={14} /> Today</TabsTrigger>
                                        <TabsTrigger value="trend" className="gap-2"><Target size={14} /> 40-Day Trend</TabsTrigger>
                                        <TabsTrigger value="categories" className="gap-2"><Flame size={14} /> Categories</TabsTrigger>
                                        <TabsTrigger value="habits" className="gap-2"><Settings2 size={14} /> Habits</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="today" className="space-y-4">
                                        {!todaysReport ? (
                                            <Card className="border-dashed border-2 bg-transparent shadow-none">
                                                <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                                                    <Calendar size={48} className="opacity-20 mb-4" />
                                                    <p className="font-medium text-foreground">No Report Submitted Yet</p>
                                                    <p className="text-sm">The Salik has not submitted today&apos;s report.</p>
                                                </CardContent>
                                            </Card>
                                        ) : (
                                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                                <Card className="xl:col-span-2 shadow-sm border-0">
                                                    <CardHeader className="bg-muted/30 border-b pb-4">
                                                        <div className="flex justify-between items-center">
                                                            <CardTitle className="text-lg">Task Breakdown</CardTitle>
                                                            <Badge variant={todaysReport.completion_percentage >= 65 ? 'default' : 'secondary'} className="text-sm">
                                                                {todaysReport.completion_percentage}% Completed
                                                            </Badge>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-0">
                                                        <div className="divide-y">
                                                            {todaysReport.report_items?.map((item, idx) => (
                                                                <div key={idx} className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                                                                    <div>
                                                                        <p className="font-medium">{item.habit_template?.name}</p>
                                                                        {item.input_value && <p className="text-xs text-muted-foreground mt-1">Value: <span className="font-semibold text-foreground">{JSON.stringify(item.input_value)}</span></p>}
                                                                    </div>
                                                                    {item.status === 'completed' && <CheckCircle2 size={22} className="text-emerald-500" />}
                                                                    {item.status === 'missed' && <XCircle size={22} className="text-rose-400 opacity-60" />}
                                                                    {item.status === 'unanswered' && <div className="w-5 h-5 border-2 border-dashed border-muted-foreground/30 rounded-full" />}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                                <div className="space-y-4">
                                                    <Card className="shadow-sm border-0 bg-blue-50/50">
                                                        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-blue-800 flex items-center gap-2"><FileText size={14} /> Salik&apos;s Reflection</CardTitle></CardHeader>
                                                        <CardContent><p className="text-sm text-blue-900/80 italic leading-relaxed">&quot;{todaysReport.notes || 'No reflection added today.'}&quot;</p></CardContent>
                                                    </Card>
                                                    <Card className="shadow-sm border-0">
                                                        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Send size={14} /> Your Feedback</CardTitle><CardDescription className="text-xs">Private note in their history.</CardDescription></CardHeader>
                                                        <CardContent className="space-y-2">
                                                            <Textarea placeholder="MashaAllah, great consistency..." className="resize-none h-24 text-sm" value={murabbiNote} onChange={e => setMurabbiNote(e.target.value)} />
                                                            <Button size="sm" className="w-full" onClick={saveMurabbiNote} disabled={savingNote}>{savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Feedback'}</Button>
                                                        </CardContent>
                                                    </Card>
                                                </div>
                                            </div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="trend">
                                        <PerformanceChart data={salikTrend} title={`${currentSalik.full_name} – 40-Day Trend`} height={400} />
                                    </TabsContent>

                                    {/* Category Breakdown Tab */}
                                    <TabsContent value="categories" className="space-y-4">
                                        <Card className="shadow-sm border-0">
                                            <CardHeader className="bg-muted/30 border-b pb-4">
                                                <CardTitle className="text-lg">Category Breakdown</CardTitle>
                                                <CardDescription>Habit completion rate by category — current Chilla window.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="p-6">
                                                {categoryStats.length === 0 ? (
                                                    <div className="text-center py-10 text-muted-foreground">
                                                        <Moon size={32} className="mx-auto mb-3 opacity-30" />
                                                        <p className="text-sm">No data yet — submit a few reports first.</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-4">
                                                        {categoryStats.map(stat => (
                                                            <div key={stat.category}>
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="text-sm font-medium">{stat.label}</span>
                                                                    <span className={`text-sm font-bold ${stat.rate >= 65 ? 'text-emerald-600' : stat.rate >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{stat.rate}%</span>
                                                                </div>
                                                                <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all duration-500 ${stat.rate >= 65 ? 'bg-emerald-500' : stat.rate >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`}
                                                                        style={{ width: `${stat.rate}%` }}
                                                                    />
                                                                </div>
                                                                <p className="text-[10px] text-muted-foreground mt-0.5">{stat.completedCount} / {stat.totalCount} completed</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="habits" className="space-y-4">
                                        <Card className="shadow-sm border-0">
                                            <CardHeader className="bg-muted/30 border-b pb-4">
                                                <CardTitle className="text-lg">Customized Habit List</CardTitle>
                                                <CardDescription>Toggle habits on or off for {currentSalik.full_name}. Changes reflect tomorrow.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                <div className="divide-y overflow-y-auto max-h-[500px]">
                                                    {assignedHabits.map((a, idx) => (
                                                        <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/10">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-semibold">{a.habit_templates?.name}</p>
                                                                    {a.habit_templates?.is_default ? (
                                                                        <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-100">Default</Badge>
                                                                    ) : (
                                                                        <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50">Pool</Badge>
                                                                    )}
                                                                </div>
                                                                <div className="flex gap-2 items-center mt-1">
                                                                    <span className="text-xs text-muted-foreground uppercase tracking-wide">{a.habit_templates?.category}</span>
                                                                </div>
                                                            </div>
                                                            <Button variant={a.is_active ? "default" : "outline"} size="sm" onClick={() => toggleSalikHabit(a.habit_id, a.is_active)} className={a.is_active ? "bg-emerald-600 hover:bg-emerald-700" : ""}>
                                                                {a.is_active ? "Active" : "Paused"}
                                                            </Button>
                                                        </div>
                                                    ))}
                                                    {assignedHabits.length === 0 && (
                                                        <div className="p-8 text-center text-muted-foreground text-sm">No habits assigned. Defaults populate after profile completion.</div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Send Encouragement Modal */}
            <Dialog open={encourageOpen} onOpenChange={setEncourageOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Send Encouragement 🌙</DialogTitle>
                        <DialogDescription>Your message will be sent as a notification to {currentSalik?.full_name}.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Textarea value={encourageMsg} onChange={e => setEncourageMsg(e.target.value.slice(0, 500))} rows={6} className="resize-none" placeholder="Write a warm message..." />
                        <p className="text-xs text-muted-foreground text-right">{encourageMsg.length}/500</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEncourageOpen(false)}>Cancel</Button>
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
