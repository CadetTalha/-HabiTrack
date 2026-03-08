// ════════════════════════════════════════════════════════════
// Admin – Manage & Reassign Saliks Page
// ════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { createClient } from '@/lib/supabase/client';
import { Users, UserCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import type { Profile } from '@/types';
import { InviteUserModal } from '@/components/shared/InviteUserModal';

export default function ManageSaliksPage() {
    const [saliks, setSaliks] = useState<(Profile & { murabbi_name?: string; mapping_id?: string })[]>([]);
    const [murabbis, setMurabbis] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const supabase = createClient();

    const fetchData = async () => {
        // Fetch all Saliks
        const { data: salikData } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'salik')
            .order('full_name');

        // Fetch all Murabbis
        const { data: murabbiData } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'murabbi')
            .order('full_name');

        // Fetch active mappings
        const { data: mappings } = await supabase
            .from('salik_murabbi_map')
            .select('*, murabbi:profiles!salik_murabbi_map_murabbi_id_fkey(full_name)')
            .eq('is_active', true);

        if (salikData) {
            const enriched = salikData.map((s) => {
                const mapping = mappings?.find((m) => m.salik_id === s.id);
                return {
                    ...s,
                    murabbi_name: (mapping?.murabbi as unknown as { full_name: string })?.full_name || 'Unassigned',
                    mapping_id: mapping?.id,
                };
            });
            setSaliks(enriched as (Profile & { murabbi_name?: string; mapping_id?: string })[]);
        }
        if (murabbiData) setMurabbis(murabbiData as Profile[]);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const assignMurabbi = async (salikId: string, murabbiId: string) => {
        setAssigning(salikId);
        try {
            const res = await fetch('/api/admin/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ salik_id: salikId, murabbi_id: murabbiId }),
            });

            if (!res.ok) throw new Error('Failed to assign');
            toast.success('Salik reassigned successfully!');
            fetchData();
        } catch {
            toast.error('Failed to assign Murabbi');
        } finally {
            setAssigning(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Manage Saliks</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        View all Saliks and reassign to Murabbis
                    </p>
                </div>
                <Button onClick={() => setShowModal(true)} className="gap-2">
                    <Users size={16} /> Add Salik
                </Button>
                <InviteUserModal
                    open={showModal}
                    onOpenChange={setShowModal}
                    defaultRole="salik"
                    onSuccess={() => { setShowModal(false); fetchData(); }}
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Users size={18} className="text-primary" />
                            All Saliks ({saliks.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : saliks.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Users size={40} className="mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No Saliks Registered</p>
                                <p className="text-sm mt-1">Invite the first Salik below to get started.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Current Murabbi</TableHead>
                                        <TableHead>Reassign To</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {saliks.map((s) => (
                                        <TableRow key={s.id}>
                                            <TableCell className="font-medium">{s.full_name}</TableCell>
                                            <TableCell className="text-muted-foreground">{s.email}</TableCell>
                                            <TableCell>
                                                <Badge variant={s.murabbi_name === 'Unassigned' ? 'destructive' : 'secondary'}>
                                                    {s.murabbi_name}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Select
                                                        onValueChange={(value) => assignMurabbi(s.id, value)}
                                                        disabled={assigning === s.id}
                                                    >
                                                        <SelectTrigger className="w-[180px] h-9">
                                                            <SelectValue placeholder="Select Murabbi" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {murabbis.map((m) => (
                                                                <SelectItem key={m.id} value={m.id}>
                                                                    {m.full_name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    {assigning === s.id && (
                                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
