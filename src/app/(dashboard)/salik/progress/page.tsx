// ════════════════════════════════════════════════════════════
// Salik – My Progress Page (Chilla Tracking)
// ════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Target, Flame, Calendar, Trophy, Sparkles, Loader2, CheckCircle2, XCircle, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type DailyReport = { report_date: string; completion_percentage: number };
type ChillaRecord = {
    id: string;
    chilla_number: number;
    start_date: string;
    end_date: string;
    is_complete: boolean;
    total_submissions: number;
    average_performance: number;
};
type HabitStat = { name: string; count: number; total: number; rate: number };
type ChillaSummary = { id: string; chilla_id: string; is_delivered: boolean; summary_text: string | null; murrabi_notes: string | null };

export default function SalikProgressPage() {
    const { profile } = useAuth();
    const supabase = createClient();
    const [loading, setLoading] = useState(true);

    const [activeChilla, setActiveChilla] = useState<ChillaRecord | null>(null);
    const [historyChillas, setHistoryChillas] = useState<ChillaRecord[]>([]);
    const [chillaReports, setChillaReports] = useState<DailyReport[]>([]);

    // Stats for active chilla
    const [currentDay, setCurrentDay] = useState(0);
    const [currentStreak, setCurrentStreak] = useState(0);
    const [avgPerformance, setAvgPerformance] = useState(0);

    // All-time stats
    const [totalReportsOverall, setTotalReportsOverall] = useState(0);
    const [longestStreakAllTime, setLongestStreakAllTime] = useState(0);

    // Best/Worst habits
    const [bestHabits, setBestHabits] = useState<HabitStat[]>([]);
    const [worstHabits, setWorstHabits] = useState<HabitStat[]>([]);

    // Summaries
    const [summaries, setSummaries] = useState<Record<string, ChillaSummary>>({});
    const [expandedSummary, setExpandedSummary] = useState<string | null>(null);

    useEffect(() => {
        if (!profile) return;
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch all chillas
            const { data: records } = await supabase
                .from('chilla_records')
                .select('*')
                .eq('salik_id', profile?.id)
                .order('created_at', { ascending: false });

            const active = records?.find(r => !r.is_complete) || null;
            const history = records?.filter(r => r.is_complete) || [];

            setActiveChilla(active);
            setHistoryChillas(history);

            // 2. Fetch all reports
            const { data: allReports } = await supabase
                .from('daily_reports')
                .select('report_date, completion_percentage')
                .eq('salik_id', profile?.id)
                .order('report_date', { ascending: true });

            if (allReports) {
                setTotalReportsOverall(allReports.length);
                calculateStreaks(allReports);

                if (active) {
                    const activeReports = allReports.filter(r =>
                        r.report_date >= active.start_date && r.report_date <= active.end_date
                    );
                    setChillaReports(activeReports);

                    if (activeReports.length > 0) {
                        const sum = activeReports.reduce((acc, curr) => acc + Number(curr.completion_percentage), 0);
                        setAvgPerformance(Math.round(sum / activeReports.length));
                    }
                }
            }

            // 3. Calculate Day N of 40
            if (active) {
                const sDate = new Date(active.start_date);
                const now = new Date();
                sDate.setHours(0, 0, 0, 0);
                now.setHours(0, 0, 0, 0);
                const diffTime = now.getTime() - sDate.getTime();
                let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                if (diffDays < 1) diffDays = 1;
                if (diffDays > 40) diffDays = 40;
                setCurrentDay(diffDays);
            }

            // 4. Fetch habit stats for active Chilla (best/worst)
            if (active) {
                const { data: reportIds } = await supabase
                    .from('daily_reports')
                    .select('id')
                    .eq('salik_id', profile?.id)
                    .gte('report_date', active.start_date)
                    .lte('report_date', active.end_date);

                if (reportIds && reportIds.length > 0) {
                    const ids = reportIds.map(r => r.id);
                    const { data: items } = await supabase
                        .from('report_items')
                        .select('status, habit_template:habit_templates(name)')
                        .in('report_id', ids);

                    if (items) {
                        const habitMap: Record<string, { name: string; completed: number; total: number }> = {};
                        items.forEach((item: any) => {
                            const name = item.habit_template?.name || 'Unknown';
                            if (!habitMap[name]) habitMap[name] = { name, completed: 0, total: 0 };
                            habitMap[name].total++;
                            if (item.status === 'completed') habitMap[name].completed++;
                        });

                        const stats: HabitStat[] = Object.values(habitMap).map(h => ({
                            name: h.name,
                            count: h.completed,
                            total: h.total,
                            rate: h.total > 0 ? Math.round((h.completed / h.total) * 100) : 0
                        }));

                        const sorted = [...stats].sort((a, b) => b.rate - a.rate);
                        setBestHabits(sorted.slice(0, 3));
                        setWorstHabits(sorted.reverse().slice(0, 3));
                    }
                }
            }

            // 5. Fetch summaries for history chillas
            if (history.length > 0) {
                const chillaIds = history.map(h => h.id);
                const { data: summaryData } = await supabase
                    .from('chilla_summaries')
                    .select('id, chilla_id, is_delivered, summary_text, murrabi_notes')
                    .in('chilla_id', chillaIds);

                if (summaryData) {
                    const summaryMap: Record<string, ChillaSummary> = {};
                    summaryData.forEach(s => { summaryMap[s.chilla_id] = s; });
                    setSummaries(summaryMap);
                }
            }

        } catch (error) {
            console.error('Error fetching progress:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStreaks = (reports: DailyReport[]) => {
        let max = 0;
        let current = 0;
        let lastDate: Date | null = null;

        reports.forEach(r => {
            const d = new Date(r.report_date);
            if (!lastDate) {
                current = 1;
            } else {
                const diffDays = Math.round((d.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
                current = diffDays === 1 ? current + 1 : 1;
            }
            if (current > max) max = current;
            lastDate = d;
        });

        if (lastDate) {
            const diffDaysFromToday = Math.round((new Date().getTime() - (lastDate as Date).getTime()) / (1000 * 3600 * 24));
            if (diffDaysFromToday > 1) current = 0;
        } else {
            current = 0;
        }

        setCurrentStreak(current);
        setLongestStreakAllTime(max);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const generateGrid = () => {
        if (!activeChilla) return null;
        const grid = [];
        const startDate = new Date(activeChilla.start_date);

        for (let i = 0; i < 40; i++) {
            const cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + i);
            const dateStr = cellDate.toISOString().split('T')[0];

            const reportForDay = chillaReports.find(r => r.report_date === dateStr);
            const isFuture = i + 1 > currentDay;

            let statusClass = "bg-secondary/30 border-secondary text-muted-foreground";
            let icon = null;

            if (!isFuture) {
                if (reportForDay) {
                    statusClass = "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600";
                    icon = <CheckCircle2 size={12} />;
                } else {
                    statusClass = "bg-red-50 dark:bg-rose-500/10 border-red-200 dark:border-rose-500/20 text-red-500";
                    icon = <XCircle size={12} />;
                }
            }

            grid.push(
                <div
                    key={i}
                    title={reportForDay ? `Day ${i + 1}: ${Math.round(reportForDay.completion_percentage)}%` : `Day ${i + 1}`}
                    className={`aspect-square rounded-md border flex flex-col items-center justify-center text-xs relative cursor-default hover:scale-110 transition-transform ${statusClass}`}
                >
                    <span className="font-mono text-[10px]">{i + 1}</span>
                    {icon && <div className="absolute -bottom-1 -right-1 bg-background rounded-full text-inherit">{icon}</div>}
                </div>
            );
        }
        return grid;
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Target className="text-primary" size={28} />
                    Spiritual Progress
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Track your 40-day Chilla journey and view past milestones.
                </p>
            </div>

            {/* All-Time Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">All-Time Reports</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 flex items-center gap-3">
                        <Calendar className="text-primary/70" size={24} />
                        <span className="text-2xl font-bold">{totalReportsOverall}</span>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current Streak</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 flex items-center gap-3">
                        <Flame className={currentStreak > 0 ? "text-orange-500" : "text-muted-foreground"} size={24} />
                        <span className="text-2xl font-bold">{currentStreak}</span>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Longest Streak</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 flex items-center gap-3">
                        <Trophy className="text-yellow-500" size={24} />
                        <span className="text-2xl font-bold">{longestStreakAllTime}</span>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chillas Completed</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 flex items-center gap-3">
                        <Sparkles className="text-emerald-500" size={24} />
                        <span className="text-2xl font-bold">{historyChillas.length}</span>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="current" className="space-y-6">
                <TabsList className="bg-secondary/50 p-1 border">
                    <TabsTrigger value="current" className="px-6 data-[state=active]:bg-background">Current Chilla</TabsTrigger>
                    <TabsTrigger value="history" className="px-6 data-[state=active]:bg-background">Chilla History</TabsTrigger>
                </TabsList>

                {/* CURRENT CHILLA TAB */}
                <TabsContent value="current" className="space-y-6">
                    {!activeChilla ? (
                        <div className="py-20 text-center border rounded-xl border-dashed bg-secondary/20">
                            <Target className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                            <h3 className="text-xl font-medium">No Active Chilla</h3>
                            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                                Your 40-day Chilla journey will automatically begin once you submit your first daily report.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* ── Chilla Hero ── */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.97 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6 sm:p-8"
                            >
                                <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                                    {/* Big Day Number */}
                                    <div className="text-center sm:text-left">
                                        <div className="text-6xl sm:text-7xl font-black font-mono tracking-tighter text-foreground leading-none">
                                            {currentDay}
                                            <span className="text-2xl font-normal text-muted-foreground">/40</span>
                                        </div>
                                        <p className="text-xs uppercase tracking-widest text-muted-foreground mt-2 font-semibold">Day — Chilla {activeChilla.chilla_number}</p>
                                    </div>

                                    <div className="flex-1 space-y-3 w-full">
                                        {/* Progress bar */}
                                        <div>
                                            <div className="h-3 w-full bg-secondary/60 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-primary rounded-full"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${Math.round((currentDay / 40) * 100)}%` }}
                                                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                                                <span>Started: {new Date(activeChilla.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                                <span>Ends: {new Date(activeChilla.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                            </div>
                                        </div>

                                        {/* Mini stats */}
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="bg-background/50 border border-border/50 rounded-xl p-3 text-center">
                                                <div className="text-xl font-bold">{chillaReports.length}</div>
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Submissions</div>
                                            </div>
                                            <div className="bg-background/50 border border-border/50 rounded-xl p-3 text-center">
                                                <div className="text-xl font-bold">{avgPerformance}%</div>
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Avg Score</div>
                                            </div>
                                            <div className="bg-background/50 border border-border/50 rounded-xl p-3 text-center">
                                                <div className="text-xl font-bold">{currentStreak}</div>
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Streak</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* ── 40-Day Calendar Grid ── */}
                            <Card className="border shadow-sm">
                                <CardHeader className="border-b bg-secondary/10">
                                    <CardTitle className="text-lg">40-Day Grid</CardTitle>
                                    <CardDescription>Hover a day to see your completion score.</CardDescription>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-10 gap-2 sm:gap-3 lg:gap-4">
                                        {generateGrid()}
                                    </div>
                                    <div className="flex items-center gap-6 mt-6 text-xs text-muted-foreground justify-center border-t pt-4">
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200" /> Completed</div>
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-red-50 dark:bg-rose-500/10 border border-red-200" /> Missed</div>
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-secondary/30 border border-secondary" /> Future</div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* ── Best & Needs Attention ── */}
                            {(bestHabits.length > 0 || worstHabits.length > 0) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Best Habits */}
                                    <Card className="border shadow-sm">
                                        <CardHeader className="border-b bg-emerald-50/50 dark:bg-emerald-500/5 pb-3">
                                            <CardTitle className="text-base font-semibold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                                                <CheckCircle2 size={16} />
                                                Best Habits ✨
                                            </CardTitle>
                                            <CardDescription className="text-xs">Most consistent this Chilla</CardDescription>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            {bestHabits.map((h, i) => (
                                                <div key={h.name} className="flex items-center gap-3 p-3 border-b last:border-b-0">
                                                    <span className="text-lg font-black text-emerald-500/40 w-6 text-center">{i + 1}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{h.name}</p>
                                                        <div className="w-full h-1.5 bg-secondary rounded-full mt-1 overflow-hidden">
                                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${h.rate}%` }} />
                                                        </div>
                                                    </div>
                                                    <span className="text-sm font-bold text-emerald-600 w-12 text-right">{h.rate}%</span>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>

                                    {/* Needs Attention */}
                                    <Card className="border shadow-sm">
                                        <CardHeader className="border-b bg-rose-50/50 dark:bg-rose-500/5 pb-3">
                                            <CardTitle className="text-base font-semibold flex items-center gap-2 text-rose-700 dark:text-rose-400">
                                                <XCircle size={16} />
                                                Needs Attention 🤲
                                            </CardTitle>
                                            <CardDescription className="text-xs">Habits to focus on</CardDescription>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            {worstHabits.map((h, i) => (
                                                <div key={h.name} className="flex items-center gap-3 p-3 border-b last:border-b-0">
                                                    <span className="text-lg font-black text-rose-500/40 w-6 text-center">{i + 1}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{h.name}</p>
                                                        <div className="w-full h-1.5 bg-secondary rounded-full mt-1 overflow-hidden">
                                                            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${h.rate}%` }} />
                                                        </div>
                                                    </div>
                                                    <span className="text-sm font-bold text-rose-600 w-12 text-right">{h.rate}%</span>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </>
                    )}
                </TabsContent>

                {/* ARCHIVE TAB */}
                <TabsContent value="history" className="space-y-4">
                    {historyChillas.length === 0 ? (
                        <div className="py-20 text-center border rounded-xl border-dashed bg-secondary/20">
                            <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                            <h3 className="text-lg font-medium">No Completed Chillas</h3>
                            <p className="text-sm text-muted-foreground mt-1">Your history will appear here once you complete a 40-day cycle.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {historyChillas.map((record) => {
                                const summary = summaries[record.id];
                                const isDelivered = summary?.is_delivered === true;
                                const isExpanded = expandedSummary === record.id;

                                return (
                                    <Card key={record.id} className="border shadow-sm overflow-hidden">
                                        <CardContent
                                            className="p-5 cursor-pointer"
                                            onClick={() => isDelivered && setExpandedSummary(isExpanded ? null : record.id)}
                                        >
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                                                            Chilla #{record.chilla_number}
                                                        </Badge>
                                                        {isDelivered ? (
                                                            <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-400/30 text-[10px]">
                                                                Summary Available ✅
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px]">
                                                                Summary Pending ⏳
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-2xl font-bold mt-2">{Math.round(record.average_performance)}% Avg</div>
                                                    <p className="text-sm text-muted-foreground mt-1">{record.total_submissions}/40 Days Logged</p>
                                                </div>
                                                <div className="text-right text-xs text-muted-foreground">
                                                    <div className="font-mono">{record.start_date}</div>
                                                    <div className="text-muted-foreground/50">to</div>
                                                    <div className="font-mono">{record.end_date}</div>
                                                </div>
                                            </div>

                                            {isDelivered && (
                                                <div className="mt-3 flex items-center gap-1.5 text-xs text-primary font-medium">
                                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                    {isExpanded ? 'Hide Summary' : 'View Murrabi Summary'}
                                                </div>
                                            )}
                                            {!isDelivered && (
                                                <p className="mt-3 text-xs text-muted-foreground italic">
                                                    Your Murrabi is preparing your summary. JazakAllah for your patience.
                                                </p>
                                            )}
                                        </CardContent>

                                        {/* Expandable Summary */}
                                        <AnimatePresence>
                                            {isDelivered && isExpanded && summary && (
                                                <motion.div
                                                    key="summary"
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.3 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="border-t bg-muted/20 p-5 space-y-4">
                                                        {summary.summary_text && (
                                                            <div>
                                                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">AI Summary</p>
                                                                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{summary.summary_text}</p>
                                                            </div>
                                                        )}
                                                        {summary.murrabi_notes && (
                                                            <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
                                                                <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">Personal Note from Your Murrabi</p>
                                                                <p className="text-sm text-foreground leading-relaxed italic">"{summary.murrabi_notes}"</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
