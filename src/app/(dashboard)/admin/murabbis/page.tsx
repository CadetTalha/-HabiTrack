// ════════════════════════════════════════════════════════════
// Admin – Manage Murabbis Page
// ════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
// Removed unused Dialog imports
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { createClient } from '@/lib/supabase/client';
import { Users, Mail, Loader2 } from 'lucide-react';
import { InviteUserModal } from '@/components/shared/InviteUserModal';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import type { Profile } from '@/types';

export default function ManageMurabbisPage() {
    const [murabbis, setMurabbis] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const supabase = createClient();

    const fetchMurabbis = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'murabbi')
            .order('created_at', { ascending: false });

        if (data) setMurabbis(data as Profile[]);
        setLoading(false);
    };

    useEffect(() => {
        fetchMurabbis();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Manage Murabbis</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Create and manage mentor accounts
                    </p>
                </div>
                <Button onClick={() => setShowModal(true)} className="gap-2">
                    <Users size={16} /> Add Murrabi
                </Button>
                <InviteUserModal
                    open={showModal}
                    onOpenChange={setShowModal}
                    defaultRole="murabbi"
                    onSuccess={() => { setShowModal(false); fetchMurabbis(); }}
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
                            All Murabbis ({murabbis.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : murabbis.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Users size={40} className="mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No Murabbis Yet</p>
                                <p className="text-sm mt-1">Invite the first Murabbi below to get started.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Joined</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {murabbis.map((m) => (
                                        <TableRow key={m.id}>
                                            <TableCell className="font-medium">{m.full_name}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    <Mail size={14} />
                                                    {m.email}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="capitalize">
                                                    {m.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {new Date(m.created_at).toLocaleDateString()}
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
