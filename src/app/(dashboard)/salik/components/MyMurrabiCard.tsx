'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Phone, GraduationCap, Building2, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface MurabbiInfo {
    id: string;
    full_name: string;
    avatar_url: string;
    university: string;
    degree: string;
    mobile_number: string;
}

export function MyMurrabiCard() {
    const { profile } = useAuth();
    const [murabbi, setMurabbi] = useState<MurabbiInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        if (!profile) return;
        const fetchMurrabi = async () => {
            const { data, error } = await supabase
                .from('salik_murabbi_map')
                .select('murabbi:profiles!salik_murabbi_map_murabbi_id_fkey(id, full_name, avatar_url, university, degree, mobile_number)')
                .eq('salik_id', profile.id)
                .eq('is_active', true)
                .single();

            if (!error && data?.murabbi) {
                setMurabbi(data.murabbi as unknown as MurabbiInfo);
            }
            setLoading(false);
        };
        fetchMurrabi();
    }, [profile, supabase]);

    if (loading) return (
        <Card className="border border-white/20 dark:border-white/5 premium-shadow glass-panel bg-card/40 flex items-center justify-center h-32">
            <Loader2 className="animate-spin text-primary" />
        </Card>
    );

    if (!murabbi) return (
        <Card className="border border-white/20 dark:border-white/5 premium-shadow glass-panel bg-card/40 h-full flex flex-col justify-center items-center text-center p-6 bg-gradient-to-br from-amber-500/5 to-transparent">
            <User size={32} className="text-amber-500/50 mb-3" />
            <h3 className="font-semibold text-lg">No Mentor Assigned</h3>
            <p className="text-sm text-muted-foreground mt-1">Please contact the admin to select a Murrabi for your spiritual journey.</p>
        </Card>
    );

    return (
        <Card className="border border-white/20 dark:border-white/5 premium-shadow glass-panel bg-card/40 h-full overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4" />
            <CardHeader className="pb-4 border-b border-border/40 relative z-10">
                <CardTitle className="text-base font-semibold text-amber-500">My Guide (Murrabi)</CardTitle>
                <CardDescription className="text-xs">Your assigned spiritual mentor</CardDescription>
            </CardHeader>
            <CardContent className="pt-5 relative z-10">
                <div className="flex items-center gap-4 mb-5">
                    <Avatar className="w-16 h-16 border-2 border-amber-500/20 shadow-lg">
                        <AvatarImage src={murabbi.avatar_url} />
                        <AvatarFallback className="text-xl bg-amber-500/10 text-amber-500">{murabbi.full_name?.charAt(0) || 'M'}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h3 className="font-bold text-lg leading-tight">{murabbi.full_name}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                            <GraduationCap size={14} className="text-amber-500/70" /> {murabbi.degree || 'Scholar'}
                        </p>
                    </div>
                </div>

                <div className="space-y-3 bg-white/40 dark:bg-black/20 p-4 rounded-xl border border-border/40 backdrop-blur-sm">
                    <div className="flex items-start gap-2.5 text-sm">
                        <Building2 size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-foreground">{murabbi.university || 'Not specified'}</span>
                    </div>
                    {murabbi.mobile_number && (
                        <div className="flex items-center gap-2.5 text-sm">
                            <Phone size={16} className="text-muted-foreground shrink-0" />
                            <a href={`https://wa.me/${murabbi.mobile_number.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                                {murabbi.mobile_number} <ArrowRight size={12} />
                            </a>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
