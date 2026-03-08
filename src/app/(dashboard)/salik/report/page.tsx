// ════════════════════════════════════════════════════════════
// Salik – Dedicated Daily Amal (Reporting) Page
// ════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { HABIT_CATEGORIES, type HabitTemplate } from '@/types';
import { BookOpen, AlertCircle, Clock, Send, Loader2, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import Link from 'next/link';

interface TaskItem {
    assignmentId: string;
    template: HabitTemplate;
    status: 'completed' | 'missed' | 'unanswered';
    inputValue?: string | number;
}

export default function DailyAmalPage() {
    const { profile } = useAuth();
    const router = useRouter();

    // Report State
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
    const [existingReportId, setExistingReportId] = useState<string | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);

    const supabase = createClient();
    const todayStr = new Date().toISOString().split('T')[0];

    useEffect(() => {
        if (!profile) return;

        const fetchData = async () => {
            setLoading(true);

            // Fetch Today's Report or Assigned Habits
            const { data: todayReport } = await supabase
                .from('daily_reports')
                .select('*, report_items(*, habit_template:habit_templates(*))')
                .eq('salik_id', profile.id)
                .eq('report_date', todayStr)
                .single();

            if (todayReport) {
                setExistingReportId(todayReport.id);
                setNotes(todayReport.notes || '');

                const loadedTasks: TaskItem[] = todayReport.report_items.map((item: any) => ({
                    assignmentId: item.id,
                    template: item.habit_template,
                    status: item.status,
                    inputValue: item.input_value,
                }));
                setTasks(loadedTasks.sort((a, b) => (a.template?.sort_order || 0) - (b.template?.sort_order || 0)));

                // Check 30 min window
                const diffMins = (new Date().getTime() - new Date(todayReport.submitted_at).getTime()) / 60000;
                if (diffMins < 30) {
                    setTimeRemaining(Math.ceil(30 - diffMins));
                } else {
                    setTimeRemaining(0);
                }
            } else {
                // Fetch assignments
                const { data: assignments } = await supabase
                    .from('salik_habit_assignments')
                    .select('id, habit_templates(*)')
                    .eq('salik_id', profile.id)
                    .eq('is_active', true);

                if (assignments) {
                    const loadedTasks = assignments
                        .map(a => ({
                            assignmentId: a.id,
                            template: a.habit_templates as unknown as HabitTemplate,
                            status: 'unanswered' as const,
                            inputValue: undefined
                        }))
                        .sort((a, b) => (a.template?.sort_order || 0) - (b.template?.sort_order || 0));
                    setTasks(loadedTasks);
                }
            }
            setLoading(false);
        };

        fetchData();
    }, [profile, supabase, todayStr]);

    // Countdown timer for edit window
    useEffect(() => {
        if (timeRemaining === null || timeRemaining <= 0) return;
        const timer = setInterval(() => {
            setTimeRemaining(prev => (prev && prev > 0) ? prev - 1 : 0);
        }, 60000);
        return () => clearInterval(timer);
    }, [timeRemaining]);

    const updateTaskStatus = (index: number, status: 'completed' | 'missed' | 'unanswered') => {
        if (timeRemaining === 0) return;
        setTasks((prev) => prev.map((t, i) => i === index ? { ...t, status } : t));
    };

    const updateInputValue = (index: number, val: any) => {
        if (timeRemaining === 0) return;
        setTasks((prev) => prev.map((t, i) => i === index ? { ...t, inputValue: val } : t));
    };

    const handleSubmit = async () => {
        if (!profile) return;
        setSubmitting(true);
        setShowConfirm(false);

        try {
            const res = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    report_date: todayStr,
                    notes,
                    items: tasks.map((t) => ({
                        habit_id: t.template.id,
                        status: t.status,
                        input_value: t.inputValue || null,
                    })),
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to submit report');
            }

            toast.success(existingReportId ? 'Report updated! JazakAllah Khair 🌙' : 'Report submitted! JazakAllah Khair 🌙');
            router.push('/salik');
            router.refresh();

        } catch (error: any) {
            toast.error(error.message);
            setSubmitting(false);
        }
    };

    const grouped = tasks.reduce((acc, item, index) => {
        const cat = item.template?.category || 'other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push({ ...item, originalIndex: index });
        return acc;
    }, {} as Record<string, (TaskItem & { originalIndex: number })[]>);

    const completedCount = tasks.filter((t) => t.status === 'completed').length;
    const progressPerc = tasks.length ? Math.round((tasks.filter(t => t.status !== 'unanswered').length / tasks.length) * 100) : 0;
    const completionPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
    const isSubmitted = !!existingReportId;
    const editLocked = timeRemaining === 0 && isSubmitted;

    const renderInputUI = (item: TaskItem & { originalIndex: number }) => {
        if (item.template.input_type === 'checkbox') return null;

        if (item.template.input_type === 'count_dropdown' || item.template.input_type === 'rakaat_dropdown') {
            const options = item.template.count_options || [];
            return (
                <Select
                    value={item.inputValue?.toString() || ''}
                    onValueChange={(v) => updateInputValue(item.originalIndex, Number(v))}
                    disabled={editLocked}
                >
                    <SelectTrigger className="w-24 h-8 text-xs bg-background">
                        <SelectValue placeholder="Value" />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map((opt) => (
                            <SelectItem key={opt} value={opt.toString()}>
                                {opt} {item.template.input_type === 'rakaat_dropdown' ? 'Rak.' : ''}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        }

        if (item.template.input_type === 'time_picker') {
            return (
                <Input
                    type="time"
                    value={item.inputValue?.toString() || ''}
                    onChange={(e) => updateInputValue(item.originalIndex, e.target.value)}
                    className="w-32 h-8 text-xs bg-background"
                    disabled={editLocked}
                />
            );
        }

        return null;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/salik">
                        <Button variant="ghost" size="icon" className="rounded-xl">
                            <ArrowLeft size={20} />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <BookOpen className="text-primary" />
                            Daily Amal Checklist
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>
                </div>
                {isSubmitted ? (
                    <Badge className="px-4 py-2 text-sm bg-emerald-500/10 text-emerald-600 border border-emerald-400/30 rounded-full">
                        ✅ Submitted
                    </Badge>
                ) : (
                    <Badge className="px-4 py-2 text-sm bg-amber-500/10 text-amber-600 border border-amber-400/30 rounded-full">
                        📋 Pending
                    </Badge>
                )}
            </div>

            {/* ── Summary Card ── */}
            <Card className="border border-white/20 dark:border-white/5 shadow-sm bg-card/40 glass-panel">
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Overall Progress</p>
                            <div className="flex items-end gap-2">
                                <span className="text-2xl font-bold text-foreground">{progressPerc}%</span>
                                <span className="text-xs text-muted-foreground mb-1">({tasks.filter(t => t.status !== 'unanswered').length}/{tasks.length} Habits)</span>
                            </div>
                            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden mt-2">
                                <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${progressPerc}%` }} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completion Score</p>
                            <p className="text-2xl font-bold text-emerald-600">{completionPercent}%</p>
                            <p className="text-xs text-muted-foreground">Successful habits today</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Edit Window</p>
                            {timeRemaining !== null && timeRemaining > 0 ? (
                                <div className="flex items-center gap-2 text-blue-600 font-semibold">
                                    <Clock size={16} className="animate-pulse" />
                                    <span>{timeRemaining} mins left</span>
                                </div>
                            ) : isSubmitted ? (
                                <Badge variant="secondary" className="bg-muted text-muted-foreground">Locked</Badge>
                            ) : (
                                <p className="text-sm text-muted-foreground">Submit to start window</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ── Habit Groups ── */}
            <div className="space-y-6 pb-20">
                <AnimatePresence>
                    {tasks.length === 0 ? (
                        <Card className="py-20 text-center text-muted-foreground border-dashed">
                            <AlertCircle size={40} className="mx-auto mb-4 opacity-40" />
                            <p className="font-semibold text-foreground">Habit Checklist Not Found</p>
                            <p className="text-sm mt-1 max-w-sm mx-auto">
                                No habits are assigned to you for today. Please contact your Murrabi.
                            </p>
                        </Card>
                    ) : (
                        Object.entries(grouped).map(([category, items]) => {
                            const catInfo = HABIT_CATEGORIES.find((c) => c.value === category);
                            return (
                                <Card key={category} className="border border-white/20 dark:border-white/5 shadow-sm overflow-hidden bg-card/40 glass-panel">
                                    <CardHeader className="bg-muted/30 border-b py-4">
                                        <div className="flex items-center gap-2">
                                            {catInfo?.icon && <catInfo.icon size={18} className="text-primary" />}
                                            <CardTitle className="text-lg">{catInfo?.label || category}</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0 divide-y divide-border/40">
                                        {items.map((item) => (
                                            <div key={item.template.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-muted/10 transition-all">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-foreground">{item.template.name}</p>
                                                    {item.template.sub_category && <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{item.template.sub_category}</p>}
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    {renderInputUI(item)}

                                                    <div className="flex items-center gap-1 bg-muted/40 p-1.5 rounded-full border border-border/40">
                                                        <button
                                                            type="button"
                                                            disabled={editLocked}
                                                            onClick={() => updateTaskStatus(item.originalIndex, 'completed')}
                                                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${item.status === 'completed' ? 'bg-emerald-500 text-white shadow-lg scale-110' : 'text-muted-foreground hover:bg-emerald-50 hover:text-emerald-500'} ${editLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            <CheckCircle2 size={20} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={editLocked}
                                                            onClick={() => updateTaskStatus(item.originalIndex, 'missed')}
                                                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${item.status === 'missed' ? 'bg-rose-500 text-white shadow-lg scale-110' : 'text-muted-foreground hover:bg-rose-50 hover:text-rose-500'} ${editLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            <XCircle size={20} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </AnimatePresence>

                {/* Optional Notes */}
                {tasks.length > 0 && (
                    <Card className="border border-white/20 dark:border-white/5 shadow-sm bg-card/40 glass-panel">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold">Reflection Journal</CardTitle>
                            <CardDescription>Share your daily experience or challenges.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Textarea
                                placeholder="Write your thoughts here... (max 300 chars)"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value.slice(0, 300))}
                                disabled={editLocked}
                                rows={4}
                                className="resize-none rounded-xl"
                                maxLength={300}
                            />
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">{notes.length}/300 characters</span>
                                {!editLocked && (
                                    <Button
                                        onClick={() => setShowConfirm(true)}
                                        disabled={submitting || progressPerc < 100}
                                        className="gap-2 rounded-xl px-8"
                                    >
                                        {submitting ? (
                                            <><Loader2 size={18} className="animate-spin" /> Saving...</>
                                        ) : (
                                            <><Send size={18} /> {existingReportId ? 'Update Report' : 'Submit Today\'s Amal'}</>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* ── Confirmation Modal ── */}
            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Submit Daily Amal Report?</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3">
                                <p>
                                    You've completed <strong>{completedCount} of {tasks.length} habits ({completionPercent}%)</strong>.
                                </p>
                                {notes && (
                                    <div className="bg-muted/40 rounded-xl p-4 text-sm italic text-muted-foreground border border-border/40">
                                        "{notes}"
                                    </div>
                                )}
                                <p className="text-sm text-muted-foreground text-amber-600 font-medium">
                                    ⚠️ You will have a 30-minute window to edit this report after submission.
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl">Review again</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSubmit} disabled={submitting} className="rounded-xl bg-primary hover:bg-primary/90">
                            {submitting ? <><Loader2 size={14} className="animate-spin mr-2" />Submitting...</> : 'JazakAllah Khair, Submit'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
