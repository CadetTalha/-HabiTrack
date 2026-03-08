'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Moon, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface ChillaRecord {
    id: string;
    chilla_number: number;
    start_date: string;
    end_date: string;
    is_complete: boolean;
}

export function ChillaCounter() {
    const { profile } = useAuth();
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [activeChilla, setActiveChilla] = useState<ChillaRecord | null>(null);
    const [justCompleted, setJustCompleted] = useState<ChillaRecord | null>(null);
    const [currentDay, setCurrentDay] = useState(0);
    const [daysRemaining, setDaysRemaining] = useState(0);

    useEffect(() => {
        if (!profile) return;

        const fetchChilla = async () => {
            const { data } = await supabase
                .from('chilla_records')
                .select('id, chilla_number, start_date, end_date, is_complete')
                .eq('salik_id', profile.id)
                .order('created_at', { ascending: false });

            if (!data) { setLoading(false); return; }

            const active = data.find(r => !r.is_complete) || null;
            const lastCompleted = data.find(r => r.is_complete) || null;

            setActiveChilla(active);

            if (!active && lastCompleted) {
                // Check if completed very recently (within 7 days)
                const endDate = new Date(lastCompleted.end_date);
                const daysSince = (new Date().getTime() - endDate.getTime()) / (1000 * 3600 * 24);
                if (daysSince <= 7) setJustCompleted(lastCompleted);
            }

            if (active) {
                const startDate = new Date(active.start_date);
                const today = new Date();
                startDate.setHours(0, 0, 0, 0);
                today.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                const day = Math.min(Math.max(diffDays, 1), 40);
                setCurrentDay(day);

                const endDate = new Date(active.end_date);
                endDate.setHours(0, 0, 0, 0);
                const remaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                setDaysRemaining(Math.max(0, remaining));
            }

            setLoading(false);
        };

        fetchChilla();
    }, [profile, supabase]);

    if (loading) {
        return (
            <Card className="border border-white/20 dark:border-white/5 shadow-sm glass-panel bg-card/40">
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </CardContent>
            </Card>
        );
    }

    // Edge case: no chilla at all
    if (!activeChilla && !justCompleted) {
        return (
            <Card className="border border-white/10 shadow-sm bg-card/40 glass-panel overflow-hidden">
                <CardContent className="p-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Moon className="text-primary" size={22} />
                    </div>
                    <div>
                        <p className="font-semibold text-foreground">Your Chilla Journey Awaits</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Bismillah! 🌙 Your 40-day Chilla begins with your first report submission.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Edge case: just completed a Chilla, no new active one
    if (!activeChilla && justCompleted) {
        return (
            <Card className="border border-amber-500/20 shadow-sm bg-amber-50/30 dark:bg-amber-500/5 overflow-hidden">
                <CardContent className="p-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="text-amber-500" size={22} />
                    </div>
                    <div>
                        <Badge variant="outline" className="text-amber-600 border-amber-400/30 bg-amber-50 dark:bg-amber-500/10 mb-2">
                            Chilla {justCompleted.chilla_number} Complete
                        </Badge>
                        <p className="font-semibold text-foreground">MashaAllah! 🎉</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            You've completed Chilla {justCompleted.chilla_number}. Your Murrabi is preparing your summary.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const fillPercent = Math.round((currentDay / 40) * 100);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <Card className="border border-white/20 dark:border-white/5 shadow-sm glass-panel bg-card/40 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none" />
                <CardContent className="p-5 relative z-10">
                    <div className="flex items-center justify-between gap-4">
                        {/* Left: Big Day Display */}
                        <div className="flex items-center gap-4">
                            <div className="text-center">
                                <div className="text-4xl sm:text-5xl font-black font-mono tracking-tighter text-foreground leading-none">
                                    {currentDay}
                                    <span className="text-lg sm:text-xl font-normal text-muted-foreground">/40</span>
                                </div>
                                <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1 font-semibold">Day</p>
                            </div>
                            <div className="h-12 w-px bg-border/50" />
                            <div>
                                <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-xs mb-1">
                                    Chilla {activeChilla!.chilla_number}
                                </Badge>
                                <p className="text-sm font-semibold text-foreground">
                                    {daysRemaining <= 5 && daysRemaining > 0 ? (
                                        <span className="text-amber-500">{daysRemaining} days remaining</span>
                                    ) : daysRemaining === 0 ? (
                                        <span className="text-emerald-500">Final day!</span>
                                    ) : (
                                        `${daysRemaining} days remaining`
                                    )}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {new Date(activeChilla!.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} →{' '}
                                    {new Date(activeChilla!.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </p>
                            </div>
                        </div>

                        {/* Right: circular progress or progress bar */}
                        <div className="hidden sm:flex flex-col items-end gap-1 min-w-[80px]">
                            <span className="text-xs text-muted-foreground font-medium">{fillPercent}%</span>
                            <span className="text-xs text-muted-foreground">complete</span>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4">
                        <div className="h-2 w-full bg-secondary/60 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-primary rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${fillPercent}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                            />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                            <span>Day 1</span>
                            <span>Day 40</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
