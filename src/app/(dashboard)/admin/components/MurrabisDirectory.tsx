'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Loader2 } from 'lucide-react';

interface DirectoryMurabbi {
    id: string;
    full_name: string;
    university: string;
    degree: string;
    avatar_url: string;
    is_profile_complete: boolean;
    salik_count: number;
}

export function MurrabisDirectory() {
    const [murabbis, setMurabbis] = useState<DirectoryMurabbi[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const fetchMurabbis = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, university, degree, avatar_url, is_profile_complete, salik_murabbi_map!salik_murabbi_map_murabbi_id_fkey(count)')
                .eq('role', 'murabbi');

            if (!error && data) {
                const mapped = data.map((m: any) => ({
                    id: m.id,
                    full_name: m.full_name,
                    university: m.university || 'N/A',
                    degree: m.degree || 'N/A',
                    avatar_url: m.avatar_url,
                    is_profile_complete: m.is_profile_complete,
                    salik_count: m.salik_murabbi_map?.[0]?.count || 0
                }));
                setMurabbis(mapped);
            }
            setLoading(false);
        };
        fetchMurabbis();
    }, [supabase]);

    if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <Card className="border border-white/20 dark:border-white/5 premium-shadow glass-panel bg-card/40 mt-6">
            <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Users size={20} className="text-primary" />
                    Murrabi Directory
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                    {murabbis.map(murabbi => (
                        <div key={murabbi.id} className="flex flex-col gap-3 p-4 rounded-xl border bg-background/50 hover:bg-background/80 transition-colors">
                            <div className="flex items-center gap-3">
                                <Avatar className="w-12 h-12">
                                    <AvatarImage src={murabbi.avatar_url} />
                                    <AvatarFallback>{murabbi.full_name?.charAt(0) || 'M'}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="font-semibold text-sm">{murabbi.full_name}</h3>
                                    <Badge variant={murabbi.is_profile_complete ? "default" : "outline"} className={murabbi.is_profile_complete ? "bg-emerald-500 hover:bg-emerald-600 px-1 py-0 h-4 text-[10px]" : "text-amber-500 border-amber-500/50 px-1 py-0 h-4 text-[10px]"}>
                                        {murabbi.is_profile_complete ? 'Active' : 'Pending Setup'}
                                    </Badge>
                                </div>
                            </div>

                            <div className="text-xs text-muted-foreground space-y-1">
                                <p><span className="font-medium text-foreground">University:</span> {murabbi.university}</p>
                                <p><span className="font-medium text-foreground">Degree:</span> {murabbi.degree}</p>
                                <p className="pt-2 mt-2 border-t font-semibold text-primary">{murabbi.salik_count} Salik{murabbi.salik_count !== 1 ? 's' : ''} assigned</p>
                            </div>
                        </div>
                    ))}
                    {murabbis.length === 0 && <p className="text-sm text-muted-foreground p-4">No Murrabis found.</p>}
                </div>
            </CardContent>
        </Card>
    );
}
