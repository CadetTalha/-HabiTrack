'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { UserCircle2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface MurrabiProfile {
    full_name: string;
    avatar_url?: string | null;
    university?: string | null;
}

export function MyMurrabiCard() {
    const { profile } = useAuth();
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [murrabi, setMurrabi] = useState<MurrabiProfile | null>(null);

    useEffect(() => {
        if (!profile) return;

        const fetchMurrabi = async () => {
            // Get active assignment
            const { data: mapData } = await supabase
                .from('salik_murabbi_map')
                .select('murabbi_id')
                .eq('salik_id', profile.id)
                .eq('is_active', true)
                .single();

            if (!mapData?.murabbi_id) { setLoading(false); return; }

            const { data: murabbiProfile } = await supabase
                .from('profiles')
                .select('full_name, avatar_url, university')
                .eq('id', mapData.murabbi_id)
                .single();

            if (murabbiProfile) setMurrabi(murabbiProfile);
            setLoading(false);
        };

        fetchMurrabi();
    }, [profile, supabase]);

    if (loading) {
        return (
            <Card className="border border-white/20 dark:border-white/5 shadow-sm glass-panel bg-card/40">
                <CardContent className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </CardContent>
            </Card>
        );
    }

    if (!murrabi) {
        return (
            <Card className="border border-white/10 shadow-sm bg-card/40 glass-panel">
                <CardContent className="py-4 px-5 flex items-center gap-3">
                    <UserCircle2 size={36} className="text-muted-foreground/40 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Murrabi</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            You'll be assigned a Murrabi after your profile setup is complete.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const initials = murrabi.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
        >
            <Card className="border border-white/20 dark:border-white/5 shadow-sm glass-panel bg-card/40 overflow-hidden">
                <CardContent className="py-4 px-5 flex items-center gap-4">
                    {/* Avatar */}
                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center flex-shrink-0 text-white font-bold text-base shadow-sm">
                        {initials}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-none mb-1">Your Murrabi</p>
                        <p className="font-semibold text-foreground truncate">{murrabi.full_name}</p>
                        {murrabi.university && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{murrabi.university}</p>
                        )}
                    </div>

                    {/* Decorative badge */}
                    <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 flex-shrink-0">
                        <span className="text-primary text-sm">🕌</span>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
