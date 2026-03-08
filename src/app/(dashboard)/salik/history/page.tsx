// ════════════════════════════════════════════════════════════
// Salik – History & Past Reports View
// ════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, Search, CheckCircle2, XCircle, FileText, Loader2, Target, CalendarDays, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DailyReport, ReportItem } from '@/types';

// Extended type to include nested data
type ExtendedReport = DailyReport & {
    report_items: (ReportItem & {
        habit_template?: { name: string; category: string; sub_category?: string };
    })[];
};

export default function HistoryPage() {
    const { profile } = useAuth();
    const [reports, setReports] = useState<ExtendedReport[]>([]);
    const [filteredReports, setFilteredReports] = useState<ExtendedReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

    const supabase = createClient();

    useEffect(() => {
        if (!profile) return;

        const fetchHistory = async () => {
            const { data, error } = await supabase
                .from('daily_reports')
                .select('*, report_items(*, habit_template:habit_templates(name, category, sub_category))')
                .eq('salik_id', profile.id)
                .order('report_date', { ascending: false });

            if (data) {
                setReports(data as unknown as ExtendedReport[]);
                setFilteredReports(data as unknown as ExtendedReport[]);
                if (data.length > 0) {
                    setSelectedReportId(data[0].id);
                }
            }
            setLoading(false);
        };

        fetchHistory();
    }, [profile, supabase]);

    // Handle Search Filter
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredReports(reports);
            return;
        }

        const q = searchQuery.toLowerCase();
        const filtered = reports.filter(r =>
            r.report_date.includes(q) ||
            (r.notes && r.notes.toLowerCase().includes(q))
        );
        setFilteredReports(filtered);
    }, [searchQuery, reports]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const selectedReport = reports.find(r => r.id === selectedReportId);

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-6 rounded-xl border shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <History className="text-primary" />
                        Spiritual Journal & History
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Review your past reports, consistency, and notes.
                    </p>
                </div>
            </div>

            {reports.length === 0 ? (
                <Card className="border-0 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-secondary/20 rounded-xl border border-dashed">
                        <CalendarDays size={48} className="opacity-30 mb-4" />
                        <p className="font-semibold text-foreground text-lg">No history available yet.</p>
                        <p className="text-sm mt-1 max-w-sm text-center">Your past daily reports will appear here once you start submitting them systematically.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Panel: Report List */}
                    <Card className="lg:col-span-1 shadow-sm border-0 bg-card overflow-hidden">
                        <CardHeader className="bg-muted/30 pb-4 border-b">
                            <CardTitle className="text-base font-semibold">Past Submissions</CardTitle>
                            <div className="relative mt-3">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="Search by date or note..."
                                    className="pl-9 h-9 text-xs"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 overflow-y-auto h-[600px] custom-scrollbar divide-y divide-border/40">
                            {filteredReports.map((r) => {
                                const dateObj = new Date(r.report_date);
                                const isSelected = selectedReportId === r.id;
                                return (
                                    <button
                                        key={r.id}
                                        onClick={() => setSelectedReportId(r.id)}
                                        className={`w-full text-left p-4 transition-colors ${isSelected ? 'bg-primary/5 hover:bg-primary/10 border-l-4 border-primary' : 'hover:bg-muted/30 border-l-4 border-transparent'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="font-semibold text-sm">
                                                {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </p>
                                            <Badge variant={r.completion_percentage >= 70 ? 'default' : 'secondary'} className="text-[10px]">
                                                {r.completion_percentage}%
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Target size={12} /> {r.report_items?.length || 0} tasks
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {dateObj.toLocaleDateString('en-US', { weekday: 'long' })}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                            {filteredReports.length === 0 && (
                                <div className="p-8 text-center text-muted-foreground text-sm">
                                    No reports found matching your search.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Right Panel: Report Details */}
                    <div className="lg:col-span-2 space-y-6">
                        <AnimatePresence mode="wait">
                            {selectedReport ? (
                                <motion.div
                                    key={selectedReport.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-6"
                                >
                                    <Card className="shadow-sm border-0">
                                        <CardHeader className="bg-primary/5 border-b pb-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <CardTitle className="text-xl">
                                                        Report for {new Date(selectedReport.report_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                                    </CardTitle>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Submitted on {new Date(selectedReport.submitted_at).toLocaleDateString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                <Badge className="text-sm px-3 py-1 bg-primary text-primary-foreground">
                                                    Score: {selectedReport.completion_percentage}%
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            {selectedReport.notes && (
                                                <div className="p-5 bg-blue-50/50 border-b border-blue-100 flex gap-3 items-start">
                                                    <FileText className="text-blue-500 mt-0.5" size={18} />
                                                    <div>
                                                        <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">Your Journal Notes</p>
                                                        <p className="text-sm text-blue-900/80 italic leading-relaxed">"{selectedReport.notes}"</p>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="divide-y divide-border/40">
                                                {selectedReport.report_items?.map((item, idx) => (
                                                    <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-medium">{item.habit_template?.name || 'Unknown Task'}</p>
                                                            </div>
                                                            <div className="flex gap-2 items-center mt-1">
                                                                <span className="text-xs text-muted-foreground uppercase tracking-wide">{item.habit_template?.category}</span>
                                                                {item.input_value && (
                                                                    <>
                                                                        <span className="text-xs text-muted-foreground/40">•</span>
                                                                        <span className="text-xs text-muted-foreground font-semibold">Value: {JSON.stringify(item.input_value)}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            {item.status === 'completed' && (
                                                                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm">
                                                                    <CheckCircle2 size={16} />
                                                                    <span className="text-xs font-semibold">Completed</span>
                                                                </div>
                                                            )}
                                                            {item.status === 'missed' && (
                                                                <div className="flex items-center gap-2 text-rose-500 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100">
                                                                    <XCircle size={16} />
                                                                    <span className="text-xs font-semibold">Missed</span>
                                                                </div>
                                                            )}
                                                            {item.status === 'unanswered' && (
                                                                <div className="flex items-center gap-2 text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-full border border-border">
                                                                    <div className="w-4 h-4 rounded-full border-2 border-dashed border-muted-foreground/50" />
                                                                    <span className="text-xs font-semibold">Unanswered</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="h-full flex items-center justify-center p-20 text-muted-foreground"
                                >
                                    Select a date from the left to view report details.
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            )}
        </div>
    );
}
