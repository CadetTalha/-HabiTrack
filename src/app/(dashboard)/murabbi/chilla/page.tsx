// ════════════════════════════════════════════════════════════
// Murabbi – Chilla Management Hub
// ════════════════════════════════════════════════════════════
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sparkles, FileText, CheckCircle2, Play, Archive, Loader2, ArrowRight, Save, Navigation } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---
type ChillaRecord = {
    id: string;
    salik_id: string;
    chilla_number: number;
    start_date: string;
    end_date: string;
    is_complete: boolean;
    total_submissions: number;
    average_performance: number;
    profiles: { full_name: string; avatar_url: string };
};

type SummaryDraft = {
    id?: string;
    ai_summary: string | null;
    murabbi_notes: string | null;
    is_finalized: boolean;
    is_delivered: boolean;
};

type AggregatedData = {
    salik_name: string;
    chilla_number: number;
    total_submissions: number;
    best_streak: number;
    week1_avg: number;
    week2_avg: number;
    week3_avg: number;
    week4_avg: number;
    category_averages: Record<string, number>;
    top_habits: { name: string; percentage: number }[];
    missed_habits: { name: string; miss_rate: number }[];
    salik_notes_snapshot: string;
    start_date: string;
    end_date: string;
};

export default function MurabbiChillaHub() {
    const [activeTab, setActiveTab] = useState('ready');
    const [records, setRecords] = useState<ChillaRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Workflow State
    const [selectedChilla, setSelectedChilla] = useState<string | null>(null);
    const [workflowStep, setWorkflowStep] = useState<number>(0);

    // Draft State
    const [aggregatedData, setAggregatedData] = useState<AggregatedData | null>(null);
    const [draftSummary, setDraftSummary] = useState<string>('');
    const [draftNotes, setDraftNotes] = useState<string>('');
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);

    useEffect(() => {
        fetchRecords();
    }, []);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/chilla');
            const data = await res.json();
            if (data.chilla_records) {
                setRecords(data.chilla_records);
            }
        } catch (error) {
            toast.error('Failed to load Chilla records.');
        } finally {
            setLoading(false);
        }
    };

    const readyRecords = records.filter(r => r.is_complete); // Needs cross-check with summaries via DB ideally
    const activeRecords = records.filter(r => !r.is_complete);
    const archivedRecords = []; // We abstract this locally for now unless we fetched summaries

    // We can assume if it's complete, it goes to Ready. 
    // Once finalized, it would disappear from GET active_only if we structured API that way,
    // but right now it's all records. We'll simplify UI array splitting logic for the mockup constraints.

    const startSummaryWorkflow = async (recordId: string) => {
        setSelectedChilla(recordId);
        setWorkflowStep(1);
        try {
            // 1. Fetch deep aggregation
            const res = await fetch(`/api/chilla/${recordId}`);
            const data = await res.json();
            if (data.aggregation) {
                setAggregatedData(data.aggregation);

                // 2. Fetch any existing draft
                const sumRes = await fetch(`/api/chilla/${recordId}/summary`);
                const sumData = await sumRes.json();
                if (sumData.summary) {
                    setDraftSummary(sumData.summary.ai_summary || '');
                    setDraftNotes(sumData.summary.murabbi_notes || '');
                } else {
                    setDraftSummary('');
                    setDraftNotes('');
                }
            }
        } catch (e) {
            toast.error('Failed to load aggregation data.');
            setWorkflowStep(0);
        }
    };

    const generateAISummary = async () => {
        if (!aggregatedData) return;
        setGenerating(true);
        try {
            const res = await fetch('/api/ai/summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    salikName: aggregatedData.salik_name,
                    chillaNumber: aggregatedData.chilla_number,
                    totalSubmissions: aggregatedData.total_submissions,
                    completionPercentage: (aggregatedData.total_submissions / 40) * 100,
                    weekAverages: [aggregatedData.week1_avg, aggregatedData.week2_avg, aggregatedData.week3_avg, aggregatedData.week4_avg],
                    categoryAverages: aggregatedData.category_averages,
                    topHabits: aggregatedData.top_habits,
                    missedHabits: aggregatedData.missed_habits,
                    bestStreak: aggregatedData.best_streak,
                    salikNotesSnapshot: aggregatedData.salik_notes_snapshot,
                }),
            });

            if (!res.ok) throw new Error();
            const data = await res.json();
            setDraftSummary(data.summary);
            toast.success('AI summary drafted successfully!');
            setWorkflowStep(3); // Auto-advance to Notes step
        } catch {
            toast.error('Failed to generate summary.');
        } finally {
            setGenerating(false);
        }
    };

    const buildPayload = (isDelivered: boolean) => ({
        is_delivered: isDelivered,
        ai_summary: draftSummary,
        murabbi_notes: draftNotes,
        week1_avg: aggregatedData?.week1_avg,
        week2_avg: aggregatedData?.week2_avg,
        week3_avg: aggregatedData?.week3_avg,
        week4_avg: aggregatedData?.week4_avg,
        top_habits: aggregatedData?.top_habits,
        missed_habits: aggregatedData?.missed_habits,
        category_averages: aggregatedData?.category_averages,
        salik_notes_snapshot: aggregatedData?.salik_notes_snapshot,
    });

    const saveDraft = async () => {
        if (!selectedChilla) return;
        setSavingDraft(true);
        try {
            const res = await fetch(`/api/chilla/${selectedChilla}/summary`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildPayload(false)),
            });
            if (!res.ok) throw new Error();
            toast.success('Draft saved! You can finalize it later.');
        } catch {
            toast.error('Failed to save draft.');
        } finally {
            setSavingDraft(false);
        }
    };

    const finalizeAndDeliver = async () => {
        if (!selectedChilla) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/chilla/${selectedChilla}/summary`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildPayload(true)),
            });
            if (!res.ok) throw new Error();
            toast.success('Summary finalized and delivered!');
            setWorkflowStep(0);
            setSelectedChilla(null);
            fetchRecords();
        } catch {
            toast.error('Failed to deliver summary.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div>;
    }

    // Workflow Overlay
    if (workflowStep > 0 && aggregatedData) {
        return (
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center gap-4 text-sm font-medium">
                    <Button variant="ghost" size="sm" onClick={() => setWorkflowStep(0)}>← Back to Hub</Button>
                    <div className="flex items-center gap-2">
                        <Badge variant={workflowStep >= 1 ? 'default' : 'secondary'}>1. Review Data</Badge>
                        <ArrowRight size={14} className="text-muted-foreground" />
                        <Badge variant={workflowStep >= 2 ? 'default' : 'secondary'}>2. Generate</Badge>
                        <ArrowRight size={14} className="text-muted-foreground" />
                        <Badge variant={workflowStep >= 3 ? 'default' : 'secondary'}>3. Personalize</Badge>
                        <ArrowRight size={14} className="text-muted-foreground" />
                        <Badge variant={workflowStep >= 4 ? 'default' : 'secondary'}>4. Preview & Send</Badge>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {/* STEP 1 & 2: Review and Generate */}
                    {workflowStep === 1 && (
                        <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                            <Card>
                                <CardHeader className="bg-primary/5 pb-4">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <CardTitle>40-Day Data Review for {aggregatedData.salik_name}</CardTitle>
                                            <CardDescription>Chilla #{aggregatedData.chilla_number} ({aggregatedData.start_date} to {aggregatedData.end_date})</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="grid md:grid-cols-2 gap-6 p-6">
                                    <div className="space-y-4">
                                        <h4 className="font-semibold text-sm">Performance Trends</h4>
                                        <div className="grid grid-cols-4 gap-2 text-center text-sm">
                                            <div className="p-2 bg-secondary/30 rounded-lg">W1<br /><span className="font-bold">{aggregatedData.week1_avg}%</span></div>
                                            <div className="p-2 bg-secondary/30 rounded-lg">W2<br /><span className="font-bold">{aggregatedData.week2_avg}%</span></div>
                                            <div className="p-2 bg-secondary/30 rounded-lg">W3<br /><span className="font-bold">{aggregatedData.week3_avg}%</span></div>
                                            <div className="p-2 bg-secondary/30 rounded-lg">W4<br /><span className="font-bold">{aggregatedData.week4_avg}%</span></div>
                                        </div>

                                        <h4 className="font-semibold text-sm mt-4">Habit Consistency</h4>
                                        <div className="space-y-2 text-sm">
                                            <div><span className="text-green-600 font-medium">Top 3:</span> {aggregatedData.top_habits.map(h => `${h.name} (${h.percentage}%)`).join(', ') || 'N/A'}</div>
                                            <div><span className="text-red-600 font-medium">Missed 3:</span> {aggregatedData.missed_habits.map(h => `${h.name} (${h.miss_rate}%)`).join(', ') || 'N/A'}</div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="font-semibold text-sm">Salik&#39;s Reflections</h4>
                                        <div className="bg-secondary/20 p-4 rounded-lg h-40 overflow-y-auto text-xs whitespace-pre-wrap font-mono">
                                            {aggregatedData.salik_notes_snapshot || "No reflections provided across the 40 days."}
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 flex justify-end mt-4">
                                        <Button onClick={generateAISummary} disabled={generating} className="gap-2 focus:ring-2 ring-primary/20">
                                            {generating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                            {generating ? 'Drafting Context...' : 'Looks good — Generate AI Summary'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {/* STEP 3 & 4 */}
                    {(workflowStep === 3 || workflowStep === 4) && (
                        <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                            <Card className="border-primary/20 shadow-md">
                                <CardHeader className="bg-primary/5 pb-4">
                                    <CardTitle>Refine & Personalize</CardTitle>
                                    <CardDescription>The AI has drafted a summary. Edit it, then add your personal notes below.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6 p-6">

                                    {workflowStep === 3 ? (
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="text-sm font-semibold flex items-center gap-1.5"><Sparkles size={16} className="text-primary" /> AI Copilot Draft</h4>
                                                    <Button variant="outline" size="sm" onClick={generateAISummary} disabled={generating}>Regenerate</Button>
                                                </div>
                                                <Textarea
                                                    className="h-64 leading-relaxed font-serif text-[15px] resize-y bg-card"
                                                    value={draftSummary}
                                                    onChange={e => setDraftSummary(e.target.value)}
                                                />
                                            </div>

                                            <Separator />

                                            <div>
                                                <h4 className="text-sm font-semibold mb-2">Your Personal Message to {aggregatedData.salik_name}</h4>
                                                <Textarea
                                                    className="h-32 bg-secondary/10"
                                                    placeholder="Add relevant Qur'anic ayaat, hadith, or personal advice for the next Chilla..."
                                                    value={draftNotes}
                                                    onChange={e => setDraftNotes(e.target.value)}
                                                />
                                            </div>
                                            <div className="flex justify-end pt-4">
                                                <Button onClick={() => setWorkflowStep(4)}>Preview Document →</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div className="bg-secondary/10 border p-8 rounded-xl space-y-8 font-serif">
                                                <div className="whitespace-pre-wrap leading-relaxed">
                                                    {draftSummary}
                                                </div>
                                                {draftNotes && (
                                                    <>
                                                        <Separator className="bg-primary/20" />
                                                        <div className="whitespace-pre-wrap leading-relaxed text-muted-foreground italic">
                                                            "{draftNotes}"
                                                            <div className="mt-4 font-semibold not-italic text-foreground">— Your Murabbi</div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex justify-between items-center gap-3 flex-wrap">
                                                <Button variant="outline" onClick={() => setWorkflowStep(3)}>← Edit Drafts</Button>
                                                <div className="flex items-center gap-2">
                                                    <Button variant="outline" onClick={saveDraft} disabled={savingDraft} className="gap-2">
                                                        {savingDraft ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                                                        {savingDraft ? 'Saving...' : 'Save Draft'}
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                                                                {saving ? <Loader2 className="animate-spin" size={14} /> : <Navigation size={14} />}
                                                                Finalize & Deliver
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Deliver this summary?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    This will deliver the Chilla summary to <strong>{aggregatedData?.salik_name}</strong>. They will be notified immediately. This action cannot be undone.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={finalizeAndDeliver} className="bg-emerald-600 hover:bg-emerald-700">
                                                                    ✅ Deliver Summary
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Chilla Core</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Manage 40-day cycles, monitor active progress, and deliver AI-powered performance summaries.
                </p>
            </div>

            <Tabs defaultValue="ready" onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-secondary/50 p-1 border">
                    <TabsTrigger value="ready" className="relative data-[state=active]:bg-background data-[state=active]:shadow-sm px-6">
                        Ready for Summary
                        {readyRecords.length > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center bg-primary text-primary-foreground text-[10px] w-4 h-4 rounded-full font-bold">
                                {readyRecords.length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="active" className="px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        Active Chillas
                    </TabsTrigger>
                    <TabsTrigger value="archive" className="px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        Archive
                    </TabsTrigger>
                </TabsList>

                {/* READY TAB */}
                <TabsContent value="ready" className="space-y-4">
                    {readyRecords.length === 0 ? (
                        <div className="py-20 text-center border rounded-xl border-dashed bg-secondary/20">
                            <CheckCircle2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                            <h3 className="text-lg font-medium">All caught up</h3>
                            <p className="text-sm text-muted-foreground mt-1">No pending Chilla summaries to generate.</p>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-4">
                            {readyRecords.map((record) => (
                                <Card key={record.id} className="border shadow-sm hover:shadow-md transition-shadow">
                                    <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10 ring-2 ring-primary/10">
                                                    <AvatarFallback>{record.profiles?.full_name?.charAt(0) || 'S'}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <h4 className="font-semibold text-sm">{record.profiles?.full_name}</h4>
                                                    <Badge variant="outline" className="mt-1 bg-primary/5 text-xs text-primary border-primary/20">
                                                        Chilla {record.chilla_number}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-bold tracking-tight text-primary">{Math.round(record.average_performance)}<span className="text-sm text-muted-foreground opacity-50">%</span></div>
                                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Avg Perf</p>
                                            </div>
                                        </div>

                                        <div className="flex gap-4 text-xs text-muted-foreground px-1 py-2 bg-secondary/30 rounded-lg">
                                            <div><span className="font-semibold text-foreground">{record.total_submissions}/40</span> Days</div>
                                            <div><span className="font-semibold text-foreground">Ended:</span> {record.end_date}</div>
                                        </div>

                                        <Button className="w-full gap-2 mt-auto shadow-sm" onClick={() => startSummaryWorkflow(record.id)}>
                                            <Sparkles size={16} />
                                            Generate AI Summary
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* ACTIVE TAB */}
                <TabsContent value="active" className="space-y-4">
                    {activeRecords.length === 0 ? (
                        <div className="py-20 text-center border rounded-xl border-dashed bg-secondary/20">
                            <Play className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground">No active Chillas currently.</p>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-4">
                            {activeRecords.map((record) => {
                                // Calculate Day X of 40 visually
                                const start = new Date(record.start_date);
                                const now = new Date();
                                const diff = Math.ceil((now.getTime() - start.getTime()) / (1000 * 3600 * 24));
                                const currentDay = diff > 40 ? 40 : (diff < 1 ? 1 : diff);
                                const progress = (currentDay / 40) * 100;

                                return (
                                    <Card key={record.id} className="border shadow-none">
                                        <CardContent className="p-5 flex items-center justify-between">
                                            <div className="flex items-center gap-4 w-full">
                                                <Avatar className="h-10 w-10">
                                                    <AvatarFallback className="bg-secondary">{record.profiles?.full_name?.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex justify-between items-center">
                                                        <h4 className="font-semibold text-sm">{record.profiles?.full_name}</h4>
                                                        <span className="text-xs font-mono font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Day {currentDay}/40</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                                                        <div className="h-full bg-primary/60 rounded-full" style={{ width: `${progress}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* ARCHIVE TAB */}
                <TabsContent value="archive" className="space-y-4">
                    <div className="py-20 text-center border rounded-xl border-dashed bg-secondary/20">
                        <Archive className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <h3 className="text-lg font-medium">Historical Vault</h3>
                        <p className="text-sm text-muted-foreground mt-1">Finalized summaries appear here for read-only tracking over time.</p>
                    </div>
                </TabsContent>

            </Tabs>
        </div >
    );
}
