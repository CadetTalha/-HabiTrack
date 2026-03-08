'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Loader2 } from 'lucide-react';

interface DirectorySalik {
    id: string;
    full_name: string;
    university: string;
    degree: string;
    avatar_url: string;
    is_profile_complete: boolean;
    murabbi_name: string | null;
}

export function SaliksDirectory() {
    const [saliks, setSaliks] = useState<DirectorySalik[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const fetchSaliks = async () => {
            // Use array syntax or singular syntax properly based on relationship. 
            // We need profiles(salik_id) mapped to salik_murabbi_map and back to profiles(murabbi_id)
            const { data, error } = await supabase
                .from('profiles')
                .select(`
                    id, full_name, university, degree, avatar_url, is_profile_complete,
                    salik_murabbi_map!salik_murabbi_map_salik_id_fkey(
                        murabbi:profiles!salik_murabbi_map_murabbi_id_fkey(full_name)
                    )
                `)
                .eq('role', 'salik');

            if (!error && data) {
                const mapped = data.map((s: any) => {
                    // Extract murabbi name from nested relations
                    const mapping = s.salik_murabbi_map?.[0];
                    const murabbiName = mapping?.murabbi?.full_name || null;

                    return {
                        id: s.id,
                        full_name: s.full_name,
                        university: s.university || 'N/A',
                        degree: s.degree || 'N/A',
                        avatar_url: s.avatar_url,
                        is_profile_complete: s.is_profile_complete,
                        murabbi_name: murabbiName
                    };
                });
                setSaliks(mapped);
            } else {
                console.error("Fetch Saliks Error:", error);
            }
            setLoading(false);
        };
        fetchSaliks();
    }, [supabase]);

    if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <Card className="border border-white/20 dark:border-white/5 premium-shadow glass-panel bg-card/40 mt-6">
            <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Users size={20} className="text-blue-500" />
                    Salik Directory
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                    {saliks.map(salik => (
                        <div key={salik.id} className="flex flex-col gap-3 p-4 rounded-xl border bg-background/50 hover:bg-background/80 transition-colors">
                            <div className="flex items-center gap-3">
                                <Avatar className="w-12 h-12">
                                    <AvatarImage src={salik.avatar_url} />
                                    <AvatarFallback>{salik.full_name?.charAt(0) || 'S'}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="font-semibold text-sm">{salik.full_name}</h3>
                                    <Badge variant={salik.is_profile_complete ? "default" : "outline"} className={salik.is_profile_complete ? "bg-blue-500 hover:bg-blue-600 px-1 py-0 h-4 text-[10px]" : "text-amber-500 border-amber-500/50 px-1 py-0 h-4 text-[10px]"}>
                                        {salik.is_profile_complete ? 'Active' : 'Pending Setup'}
                                    </Badge>
                                </div>
                            </div>

                            <div className="text-xs text-muted-foreground space-y-1">
                                <p><span className="font-medium text-foreground">University:</span> {salik.university}</p>
                                <p><span className="font-medium text-foreground">Degree:</span> {salik.degree}</p>
                                <p className="pt-2 mt-2 border-t text-foreground">
                                    <span className="font-semibold text-primary/80">Mentor: </span>
                                    {salik.murabbi_name ? salik.murabbi_name : <span className="text-amber-500">Not Assigned</span>}
                                </p>
                            </div>
                        </div>
                    ))}
                    {saliks.length === 0 && <p className="text-sm text-muted-foreground p-4">No Saliks found.</p>}
                </div>
            </CardContent>
        </Card>
    );
}
