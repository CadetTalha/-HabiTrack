// ════════════════════════════════════════════════════════════
// Admin – System Analytics
// ════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import { PerformanceChart } from '@/components/shared/PerformanceChart';
import { PerformanceRing } from '@/components/shared/PerformanceRing';
import { StatsCard } from '@/components/shared/StatsCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { BarChart3, Users, Target, Shield, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminAnalyticsPage() {
    const [trendData, setTrendData] = useState<{ date: string; percentage: number }[]>([]);
    const [stats, setStats] = useState({
        overallAvg: 0,
        activeDays: 0,
        totalSubmissions: 0,
        completedChillas: 0,
        activeChillas: 0,
        avgChillaScore: 0
    });
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                // 1. Fetch 30-day daily reports
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
                const startDateStr = thirtyDaysAgo.toISOString().split('T')[0];

                const { data: reports } = await supabase
                    .from('daily_reports')
                    .select('report_date, completion_percentage')
                    .gte('report_date', startDateStr);

                // Group by date
                const dateMap: Record<string, number[]> = {};
                for (let i = 29; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    dateMap[d.toISOString().split('T')[0]] = [];
                }

                if (reports) {
                    reports.forEach((r) => {
                        if (dateMap[r.report_date]) {
                            dateMap[r.report_date].push(Number(r.completion_percentage));
                        }
                    });
                }

                const days = [];
                let totalPercentageSum = 0;
                let totalReportsCount = 0;
                let activeDaysCount = 0;

                for (const [dateStr, values] of Object.entries(dateMap)) {
                    let avg = 0;
                    if (values.length > 0) {
                        const sum = values.reduce((a, b) => a + b, 0);
                        avg = Math.round(sum / values.length);
                        totalPercentageSum += sum;
                        totalReportsCount += values.length;
                        activeDaysCount++;
                    }

                    const dObj = new Date(dateStr);
                    days.push({
                        date: dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                        percentage: avg,
                    });
                }

                setTrendData(days);

                // 2. Fetch Chilla Records
                const { data: chillas } = await supabase
                    .from('chilla_records')
                    .select('is_complete, average_performance');

                let completedCount = 0;
                let activeCount = 0;
                let chillaScoreSum = 0;

                if (chillas) {
                    chillas.forEach(c => {
                        if (c.is_complete) {
                            completedCount++;
                            chillaScoreSum += Number(c.average_performance || 0);
                        } else {
                            activeCount++;
                        }
                    });
                }

                setStats({
                    overallAvg: totalReportsCount > 0 ? Math.round(totalPercentageSum / totalReportsCount) : 0,
                    activeDays: activeDaysCount,
                    totalSubmissions: totalReportsCount,
                    completedChillas: completedCount,
                    activeChillas: activeCount,
                    avgChillaScore: completedCount > 0 ? Math.round(chillaScoreSum / completedCount) : 0
                });
            } catch (error) {
                console.error("Error fetching analytics:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [supabase]);

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-2xl font-bold">System Analytics</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Ummah-wide performance metrics and Chilla aggregation.
                </p>
            </motion.div>

            {/* Quick KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatsCard
                    title="System Average"
                    value={`${stats.overallAvg}%`}
                    subtitle="Last 30 days"
                    icon={BarChart3}
                    index={0}
                />
                <StatsCard
                    title="Active Ummah Days"
                    value={stats.activeDays}
                    subtitle="Days with reports"
                    icon={Target}
                    index={1}
                />
                <StatsCard
                    title="Total Submissions"
                    value={stats.totalSubmissions}
                    subtitle="30-day volume"
                    icon={Users}
                    index={2}
                />
                <StatsCard
                    title="Completed Chillas"
                    value={stats.completedChillas}
                    subtitle="All-time finishes"
                    icon={Shield}
                    index={3}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="lg:col-span-2">
                    <PerformanceChart data={trendData} title="30-Day Platform Trend" />
                </div>

                {/* Secondary Metrics Column */}
                <div className="space-y-4 sm:space-y-6 flex flex-col">
                    <Card className="border border-white/20 dark:border-white/5 shadow-sm glass-panel bg-card/40 flex-1">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold">Overall Score</CardTitle>
                            <CardDescription className="text-xs">Based on {stats.totalSubmissions} recent submissions</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center py-6">
                            <PerformanceRing
                                percentage={stats.overallAvg}
                                size={160}
                                strokeWidth={12}
                                label="Platform Env"
                                sublabel="Last 30 days"
                            />
                        </CardContent>
                    </Card>

                    <Card className="border border-white/20 dark:border-white/5 shadow-sm glass-panel bg-card/40 flex-1">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold">Chilla Health</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b border-border/50">
                                <span className="text-sm text-muted-foreground">Active Chillas</span>
                                <span className="font-semibold">{stats.activeChillas}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-border/50">
                                <span className="text-sm text-muted-foreground">Historical Completions</span>
                                <span className="font-semibold">{stats.completedChillas}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-sm text-muted-foreground">Average Final Score</span>
                                <span className="font-semibold text-primary">{stats.avgChillaScore}%</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
