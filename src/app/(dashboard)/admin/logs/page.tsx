// ════════════════════════════════════════════════════════════
// Admin – Activity Logs Page
// ════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { createClient } from '@/lib/supabase/client';
import { FileText, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ActivityLog } from '@/types';
import { cn } from '@/lib/utils';

const ActionColors: Record<string, string> = {
    'REPORT_SUBMITTED': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20',
    'PROFILE_COMPLETED': 'bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20',
    'CHILLA_STARTED': 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20 hover:bg-indigo-500/20',
    'CHILLA_COMPLETED': 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20',
    'SUMMARY_GENERATED': 'bg-purple-500/10 text-purple-500 border-purple-500/20 hover:bg-purple-500/20',
    'SUMMARY_DELIVERED': 'bg-pink-500/10 text-pink-500 border-pink-500/20 hover:bg-pink-500/20',
    'INVITE_SENT': 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20 hover:bg-cyan-500/20',
    'BROADCAST_SENT': 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20',
    'SALIK_REASSIGNED': 'bg-orange-500/10 text-orange-500 border-orange-500/20 hover:bg-orange-500/20',
};

export default function ActivityLogsPage() {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const fetchLogs = async () => {
            const { data } = await supabase
                .from('activity_logs')
                .select('*, user:profiles(full_name, role)')
                .order('created_at', { ascending: false })
                .limit(50);

            if (data) setLogs(data as unknown as ActivityLog[]);
            setLoading(false);
        };
        fetchLogs();
    }, [supabase]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Activity Logs</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    System-wide activity and event history
                </p>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <FileText size={18} className="text-primary" />
                            Recent Logs
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <FileText size={40} className="mx-auto mb-3 opacity-30" />
                                <p>No activity logs yet</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead>Details</TableHead>
                                        <TableHead>Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="font-medium">
                                                {log.user?.full_name || 'System'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={cn("text-[10px] tracking-wider font-semibold", ActionColors[log.action] || "bg-secondary/50")}
                                                >
                                                    {log.action.replace(/_/g, ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate">
                                                {log.details || '—'}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                                                {new Date(log.created_at).toLocaleString()}
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
