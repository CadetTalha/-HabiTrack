// ════════════════════════════════════════════════════════════
// Murabbi – Performance Analytics Page
// ════════════════════════════════════════════════════════════
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PerformanceChart } from '@/components/shared/PerformanceChart';
import { PerformanceRing } from '@/components/shared/PerformanceRing';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Users, Activity, Moon } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { HABIT_CATEGORIES } from '@/types';

type Salik = { id: string; full_name: string };
type DailyReport = { report_date: string; completion_percentage: number; salik_id: string };
type ChillaRecord = { id: string; chilla_number: number; start_date: string; end_date: string };
type CategoryStat = { category: string; label: string; rate: number };

export default function MurabbiPerformancePage() {
    const { profile } = useAuth();
    const supabase = createClient();
    const [loading, setLoading] = useState(true);

    // Data State
    const [saliks, setSaliks] = useState<Salik[]>([]);
    const [reports, setReports] = useState<DailyReport[]>([]);
    const [activeChillaCount, setActiveChillaCount] = useState(0);
    const [selectedSalik, setSelectedSalik] = useState<string>('all');

    // Chilla cycle filter state
    const [chillas, setChillas] = useState<ChillaRecord[]>([]);
    const [selectedChilla, setSelectedChilla] = useState<string>('all'); // 'all' or chilla id
    const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
    const [loadingCats, setLoadingCats] = useState(false);

    const fetchDashboardData = useCallback(async () => {
        if (!profile) return;
        setLoading(true);
        try {
            // Fetch assigned saliks
            const { data: mapping } = await supabase
                .from('salik_murabbi_map')
                .select('salik_id, profiles!salik_murabbi_map_salik_id_fkey(full_name)')
                .eq('murabbi_id', profile.id)
                .eq('is_active', true);

            const fetchedSaliks: Salik[] = (mapping || []).map(m => ({
                id: m.salik_id,
                full_name: (m.profiles as unknown as { full_name: string })?.full_name || 'Unknown',
            }));
            setSaliks(fetchedSaliks);

            const salikIds = fetchedSaliks.map(s => s.id);

            if (salikIds.length > 0) {
                // Active chillas count
                const { count } = await supabase
                    .from('chilla_records')
                    .select('id', { count: 'exact' })
                    .in('salik_id', salikIds)
                    .eq('is_complete', false);
                setActiveChillaCount(count || 0);

                // Fetch reports for last 14 days
                const cutoff = subDays(new Date(), 14).toISOString().split('T')[0];
                const { data: reportData } = await supabase
                    .from('daily_reports')
                    .select('salik_id, report_date, completion_percentage')
                    .in('salik_id', salikIds)
                    .gte('report_date', cutoff);
                setReports(reportData || []);
            }
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    }, [profile, supabase]);

    useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

    // Fetch Chilla cycles when a specific Salik is selected
    useEffect(() => {
        if (selectedSalik === 'all') {
            setChillas([]);
            setSelectedChilla('all');
            setCategoryStats([]);
            return;
        }

        const fetchChillas = async () => {
            const { data } = await supabase
                .from('chilla_records')
                .select('id, chilla_number, start_date, end_date')
                .eq('salik_id', selectedSalik)
                .order('chilla_number', { ascending: true });
            setChillas(data || []);
            setSelectedChilla('all');
        };
        fetchChillas();
    }, [selectedSalik, supabase]);

    // Fetch category stats when Salik + Chilla filter changes
    useEffect(() => {
        if (selectedSalik === 'all') return;

        const fetchCategoryStats = async () => {
            setLoadingCats(true);
            try {
                let startDate: string | null = null;
                let endDate: string | null = null;

                if (selectedChilla !== 'all') {
                    const chilla = chillas.find(c => c.id === selectedChilla);
                    if (chilla) { startDate = chilla.start_date; endDate = chilla.end_date; }
                }

                let query = supabase
                    .from('daily_reports')
                    .select('id')
                    .eq('salik_id', selectedSalik);

                if (startDate) query = query.gte('report_date', startDate);
                if (endDate) query = query.lte('report_date', endDate);

                const { data: reportIds } = await query;

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
                            return { category: cat, label: catInfo?.label || cat, rate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0 };
                        }).sort((a, b) => b.rate - a.rate);
                        setCategoryStats(stats);
                    }
                } else {
                    setCategoryStats([]);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingCats(false);
            }
        };
        fetchCategoryStats();
    }, [selectedSalik, selectedChilla, chillas, supabase]);

    // Calculate aggregated metrics — filtered by Chilla range if applicable
    const { groupAvg, chartData } = useMemo(() => {
        let relevantReports = reports;
        if (selectedSalik !== 'all') {
            relevantReports = reports.filter(r => r.salik_id === selectedSalik);
        }

        if (selectedChilla !== 'all') {
            const chilla = chillas.find(c => c.id === selectedChilla);
            if (chilla) {
                relevantReports = relevantReports.filter(r =>
                    r.report_date >= chilla.start_date && r.report_date <= chilla.end_date
                );
            }
        }

        const dateBuckets: Record<string, { sum: number; count: number }> = {};
        for (let i = 13; i >= 0; i--) {
            const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
            dateBuckets[d] = { sum: 0, count: 0 };
        }

        let totalValue = 0;
        let totalCount = 0;
        relevantReports.forEach(r => {
            if (dateBuckets[r.report_date]) {
                dateBuckets[r.report_date].sum += Number(r.completion_percentage);
                dateBuckets[r.report_date].count += 1;
            }
            totalValue += Number(r.completion_percentage);
            totalCount += 1;
        });

        const overallAvg = totalCount > 0 ? Math.round(totalValue / totalCount) : 0;
        const formattedChartData = Object.entries(dateBuckets).map(([date, stats]) => ({
            date: format(new Date(date), 'MMM d'),
            percentage: stats.count > 0 ? Math.round(stats.sum / stats.count) : 0,
        }));

        return { groupAvg: overallAvg, chartData: formattedChartData };
    }, [reports, selectedSalik, selectedChilla, chillas]);

    if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div>;

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Performance Analytics</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Detailed performance insights across all assigned Saliks.</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Salik filter */}
                    <div className="flex items-center gap-2 bg-secondary/30 p-2 rounded-lg border">
                        <span className="text-sm font-medium pl-2">Salik:</span>
                        <Select value={selectedSalik} onValueChange={setSelectedSalik}>
                            <SelectTrigger className="w-44 bg-background border-primary/20">
                                <SelectValue placeholder="All Saliks" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Entire Group</SelectItem>
                                {saliks.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Chilla Cycle filter — only shows when a Salik is selected */}
                    {selectedSalik !== 'all' && chillas.length > 0 && (
                        <div className="flex items-center gap-2 bg-secondary/30 p-2 rounded-lg border">
                            <span className="text-sm font-medium pl-2">Chilla:</span>
                            <Select value={selectedChilla} onValueChange={setSelectedChilla}>
                                <SelectTrigger className="w-36 bg-background border-primary/20">
                                    <SelectValue placeholder="All Cycles" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Cycles</SelectItem>
                                    {chillas.map(c => (
                                        <SelectItem key={c.id} value={c.id}>
                                            Chilla {c.chilla_number}
                                            {' '}({c.start_date.slice(0, 7)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-primary/10 bg-secondary/10 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Chosen View Average</CardTitle>
                        <Activity className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">{groupAvg}%</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {selectedChilla !== 'all' ? 'Within selected Chilla cycle' : 'Consistency over last 14 days'}
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-primary/10 bg-secondary/10 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Active Chillas</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">{activeChillaCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">Saliks currently in 40-day cycles</p>
                    </CardContent>
                </Card>
                <Card className="border-primary/10 bg-secondary/10 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Saliks</CardTitle>
                        <Users className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">{saliks.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">Assigned to your mentorship</p>
                    </CardContent>
                </Card>
            </div>

            {/* Chart + Ring */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <PerformanceChart
                        data={chartData}
                        title={selectedSalik === 'all' ? 'Group Trend (14 Days)' : `${saliks.find(s => s.id === selectedSalik)?.full_name ?? 'Salik'} Trend`}
                    />
                </div>
                <Card className="border shadow-sm">
                    <CardHeader className="bg-secondary/20 pb-4">
                        <CardTitle className="text-base font-semibold">Average Consistency</CardTitle>
                        <CardDescription>
                            {selectedChilla !== 'all'
                                ? `Chilla ${chillas.find(c => c.id === selectedChilla)?.chilla_number ?? ''}`
                                : 'Overall performance metric'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center gap-6 py-12">
                        <PerformanceRing percentage={groupAvg} size={160} label={selectedSalik === 'all' ? 'Group Avg' : 'Salik Avg'} />
                    </CardContent>
                </Card>
            </div>

            {/* Category Breakdown — only when a specific Salik is selected */}
            {selectedSalik !== 'all' && (
                <Card className="border shadow-sm">
                    <CardHeader className="bg-muted/20 border-b pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-semibold">Category Breakdown</CardTitle>
                                <CardDescription className="text-xs">
                                    Habit completion rate by category
                                    {selectedChilla !== 'all' ? ` — Chilla ${chillas.find(c => c.id === selectedChilla)?.chilla_number}` : ''}
                                </CardDescription>
                            </div>
                            {selectedChilla !== 'all' && (
                                <Badge variant="outline" className="text-xs">
                                    Chilla {chillas.find(c => c.id === selectedChilla)?.chilla_number} ({chillas.find(c => c.id === selectedChilla)?.start_date?.slice(0, 7)})
                                </Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        {loadingCats ? (
                            <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>
                        ) : categoryStats.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">
                                <Moon size={32} className="mx-auto mb-3 opacity-30" />
                                <p className="text-sm">No data for this selection yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-4 max-w-2xl">
                                {categoryStats.map(stat => (
                                    <div key={stat.category}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium">{stat.label}</span>
                                            <span className={`text-sm font-bold ${stat.rate >= 65 ? 'text-emerald-600' : stat.rate >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                                                {stat.rate}%
                                            </span>
                                        </div>
                                        <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${stat.rate >= 65 ? 'bg-emerald-500' : stat.rate >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`}
                                                style={{ width: `${stat.rate}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
