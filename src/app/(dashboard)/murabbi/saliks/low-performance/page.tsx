// ════════════════════════════════════════════════════════════
// Murabbi – Low Performance Center
// ════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AlertTriangle, Loader2, ArrowLeft, HeartHandshake } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Profile } from '@/types';
import { toast } from 'sonner';
import Link from 'next/link';

export default function LowPerformancePage() {
    const { profile } = useAuth();
    const [saliks, setSaliks] = useState<(Profile & { avgPerf: number })[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendingId, setSendingId] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        if (!profile) return;

        const fetchSaliks = async () => {
            const { data: mappings } = await supabase
                .from('salik_murabbi_map')
                .select('salik_id, salik:profiles!salik_murabbi_map_salik_id_fkey(*)')
                .eq('murabbi_id', profile.id)
                .eq('is_active', true);

            const enriched = [];

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const cutoffStr = sevenDaysAgo.toISOString().split('T')[0];

            for (const mapping of mappings || []) {
                const salik = mapping.salik as unknown as Profile;

                // Fetch last 7 days only
                const { data: reports } = await supabase
                    .from('daily_reports')
                    .select('completion_percentage')
                    .eq('salik_id', salik.id)
                    .gte('report_date', cutoffStr);

                const avg = reports && reports.length > 0
                    ? Math.round(reports.reduce((a, b) => a + Number(b.completion_percentage), 0) / reports.length)
                    : 0; // If they have 0 reports in 7 days, they are 0% (Low)

                if (avg < 65) {
                    enriched.push({ ...salik, avgPerf: avg });
                }
            }

            setSaliks(enriched.sort((a, b) => a.avgPerf - b.avgPerf)); // Lowest first
            setLoading(false);
        };

        fetchSaliks();
    }, [profile, supabase]);

    const sendEncouragement = async (id: string, name: string) => {
        setSendingId(id);
        try {
            const res = await fetch('/api/admin/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    salik_id: id,
                    title: 'Checking In',
                    message: `As-salamu alaykum ${name}. I noticed your daily reports have been missing or lower recently. Let me know if everything is okay or if you need help adjusting your habits. We are in this together!`,
                })
            });

            if (!res.ok) throw new Error();
            toast.success(`Encouragement sent to ${name}`);
        } catch {
            toast.error('Failed to send message');
        } finally {
            setSendingId(null);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                <Link href="/murabbi/saliks">
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <ArrowLeft size={20} />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-rose-600">
                        <AlertTriangle className="text-rose-500" />
                        Low Performance Center
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Saliks with less than 65% consistency over the past 7 days. REACH OUT.
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : saliks.length === 0 ? (
                <Card className="border-0 shadow-sm bg-emerald-50/50">
                    <CardContent className="text-center py-16 text-emerald-800">
                        <HeartHandshake size={48} className="mx-auto mb-4 opacity-40 text-emerald-600" />
                        <p className="font-semibold text-lg">Alhamdulillah!</p>
                        <p className="text-sm mt-1">None of your Saliks are currently in the low-performance threshold.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {saliks.map((s, i) => (
                        <motion.div
                            key={s.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.05 }}
                        >
                            <Card className="border-rose-100 shadow-sm hover:shadow-md transition-all bg-gradient-to-br from-rose-50/30 to-white overflow-hidden">
                                <CardContent className="p-5 flex flex-col items-center text-center">
                                    <Avatar className="w-16 h-16 border-2 border-rose-100 shadow-sm mb-3">
                                        <AvatarImage src={s.avatar_url} />
                                        <AvatarFallback className="bg-rose-100 text-rose-700 text-xl font-bold">
                                            {s.full_name.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <h3 className="font-bold text-foreground truncate w-full">{s.full_name}</h3>
                                    <p className="text-xs text-muted-foreground mb-4">{s.mobile_number || 'No contact info'}</p>

                                    <div className="bg-rose-50 text-rose-700 font-bold py-2 px-6 rounded-full text-lg mb-5 border border-rose-100 shadow-inner">
                                        {s.avgPerf}% <span className="text-xs font-normal text-rose-600 ml-1">Avg</span>
                                    </div>

                                    <Button
                                        className="w-full bg-rose-600 hover:bg-rose-700 gap-2 shadow-sm text-sm"
                                        onClick={() => sendEncouragement(s.id, s.full_name)}
                                        disabled={sendingId === s.id}
                                    >
                                        {sendingId === s.id ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
                                        Send Encouragement
                                    </Button>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
