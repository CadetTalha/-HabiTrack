// ════════════════════════════════════════════════════════════
// Murabbi – Task Templates Management Page
// ════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { HABIT_CATEGORIES, type HabitTemplate, type HabitCategory } from '@/types';
import { Plus, ClipboardList, Trash2, Loader2, Power } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function TaskTemplatesPage() {
    const { profile } = useAuth();
    const [templates, setTemplates] = useState<HabitTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [resettingDefaults, setResettingDefaults] = useState(false);
    const [form, setForm] = useState({
        category: '' as HabitCategory | '',
        name: '',
        sub_category: '',
        input_type: 'checkbox' as 'checkbox' | 'count_dropdown' | 'rakaat_dropdown' | 'time_picker',
        count_options: '', // comma separated string for UI, convert to array on submit
    });

    const fetchTemplates = async () => {
        if (!profile) return;
        try {
            const res = await fetch('/api/habits');
            const data = await res.json();
            if (data.habits) {
                setTemplates(data.habits);
            }
        } catch (error) {
            console.error('Failed to fetch habits', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, [profile]);

    const createTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile || !form.category) return;
        setCreating(true);

        const countOpts = form.count_options
            ? form.count_options.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n))
            : null;

        try {
            const res = await fetch('/api/habits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name,
                    category: form.category,
                    sub_category: form.sub_category || undefined,
                    input_type: form.input_type,
                    count_options: countOpts,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create template');
            }
            toast.success('Habit added to pool!');
            setForm({ category: '', name: '', sub_category: '', input_type: 'checkbox', count_options: '' });
            setDialogOpen(false);
            fetchTemplates();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setCreating(false);
        }
    };

    const deleteTemplate = async (id: string) => {
        try {
            const res = await fetch(`/api/habits/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to delete template');
            }
            toast.success('Template deleted from pool');
            fetchTemplates();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const toggleGlobal = async (id: string, currentActiveStateToAssign: boolean) => {
        try {
            const res = await fetch(`/api/habits/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: currentActiveStateToAssign })
            });
            if (!res.ok) throw new Error();
            toast.success(`Habit ${currentActiveStateToAssign ? 'activated' : 'deactivated'} for all assigned Saliks`);
        } catch {
            toast.error('Failed to toggle habit');
        }
    };

    const resetToDefaults = async () => {
        if (!confirm('This will reset your default template to the standard HabiTrack template. Your custom pool habits will remain. Continue?')) return;
        setResettingDefaults(true);
        try {
            const res = await fetch('/api/habits/reset-defaults', { method: 'POST' });
            if (!res.ok) throw new Error();
            toast.success('Default template reset to standard HabiTrack template!');
            fetchTemplates();
        } catch {
            toast.error('Failed to reset defaults.');
        } finally {
            setResettingDefaults(false);
        }
    };

    // Separate into defaults and pool
    const defaultTemplates = templates.filter(t => t.is_default);
    const poolTemplates = templates.filter(t => !t.is_default);

    const groupByCategory = (list: HabitTemplate[]) => {
        return list.reduce((acc, t) => {
            if (!acc[t.category]) acc[t.category] = [];
            acc[t.category].push(t);
            return acc;
        }, {} as Record<string, HabitTemplate[]>);
    };

    const renderTable = (groupedList: Record<string, HabitTemplate[]>, isPool: boolean) => {
        if (Object.keys(groupedList).length === 0) {
            return (
                <Card className="border-0 shadow-sm mt-4">
                    <CardContent className="text-center py-12">
                        <ClipboardList size={40} className="mx-auto mb-3 opacity-30 text-muted-foreground" />
                        <p className="font-medium text-muted-foreground">No Habits Yet</p>
                    </CardContent>
                </Card>
            );
        }

        return Object.entries(groupedList).map(([category, tasks]) => {
            const catInfo = HABIT_CATEGORIES.find((c) => c.value === category);
            return (
                <motion.div
                    key={category}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-4"
                >
                    <Card className="border-0 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/40 pb-3 border-b">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                {catInfo?.icon && <catInfo.icon className="text-primary text-lg" />}
                                {catInfo?.label || category}
                                <Badge variant="secondary" className="ml-2 text-xs font-normal">
                                    {tasks.length} tasks
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="pl-6 w-[40%]">Habit Name</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Global Toggle</TableHead>
                                        {isPool && <TableHead className="w-[80px] text-right pr-6">Actions</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tasks.map((t) => (
                                        <TableRow key={t.id} className="group">
                                            <TableCell className="pl-6 font-medium">
                                                {t.name}
                                                {t.sub_category && <span className="ml-2 text-xs text-muted-foreground">({t.sub_category})</span>}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs font-normal bg-background">
                                                    {t.input_type.replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => toggleGlobal(t.id, true)} className="h-7 text-xs text-emerald-600 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100">
                                                        Enable All
                                                    </Button>
                                                    <Button variant="outline" size="sm" onClick={() => toggleGlobal(t.id, false)} className="h-7 text-xs text-rose-600 border-rose-200 bg-rose-50/50 hover:bg-rose-100">
                                                        Disable All
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            {isPool && (
                                                <TableCell className="text-right pr-6">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => deleteTemplate(t.id)}
                                                        className="text-muted-foreground hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Trash2 size={16} />
                                                    </Button>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </motion.div>
            );
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between bg-card p-6 rounded-xl shadow-sm border">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Habit Templates</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage the default checklist and your personal habit pool.
                    </p>
                </div>

                {/* Header buttons */}
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Button variant="outline" onClick={resetToDefaults} disabled={resettingDefaults} className="gap-2 text-sm">
                        {resettingDefaults ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
                        Reset to Default
                    </Button>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2 shadow-sm">
                                <Plus size={16} />
                                Add to Pool
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Habit to Pool</DialogTitle>
                                <DialogDescription>
                                    Create a custom habit you can assign to your Saliks.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={createTemplate} className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Select
                                        value={form.category}
                                        onValueChange={(v) => setForm({ ...form, category: v as HabitCategory })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {HABIT_CATEGORIES.map((c) => (
                                                <SelectItem key={c.value} value={c.value}>
                                                    <div className="flex items-center gap-2">
                                                        <c.icon className="text-muted-foreground" />
                                                        <span>{c.label}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Habit Name</Label>
                                    <Input
                                        placeholder="e.g., Read 10 pages"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Input Type</Label>
                                    <Select
                                        value={form.input_type}
                                        onValueChange={(v) => setForm({ ...form, input_type: v as any })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select input type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="checkbox">Checkbox (Completed / Missed)</SelectItem>
                                            <SelectItem value="count_dropdown">Numeric Dropdown (e.g. 100, 200)</SelectItem>
                                            <SelectItem value="rakaat_dropdown">Rakaat (2, 4, 6...)</SelectItem>
                                            <SelectItem value="time_picker">Time Picker (e.g. Bed Timings)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {form.input_type === 'count_dropdown' && (
                                    <div className="space-y-2">
                                        <Label>Count Options (Comma separated)</Label>
                                        <Input
                                            placeholder="e.g., 100, 200, 300"
                                            value={form.count_options}
                                            onChange={(e) => setForm({ ...form, count_options: e.target.value })}
                                        />
                                        <p className="text-xs text-muted-foreground">The Salik will select one of these values from a dropdown.</p>
                                    </div>
                                )}
                                <Button type="submit" className="w-full mt-4" disabled={creating}>
                                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Habit'}
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Tabs defaultValue="default" className="w-full">
                <TabsList className="grid w-full max-w-[400px] grid-cols-2">
                    <TabsTrigger value="default">Default Template</TabsTrigger>
                    <TabsTrigger value="pool">Habit Pool</TabsTrigger>
                </TabsList>

                <TabsContent value="default" className="mt-6 animation-fade-in">
                    <div className="mb-4 text-sm text-muted-foreground flex items-center gap-2 bg-blue-50/50 text-blue-800 p-3 rounded-md border border-blue-100">
                        <Power size={16} className="text-blue-500" />
                        These are the standard habits automatically assigned to all Saliks. You can toggle them for everyone here, or per-Salik on the My Saliks page.
                    </div>
                    {renderTable(groupByCategory(defaultTemplates), false)}
                </TabsContent>

                <TabsContent value="pool" className="mt-6 animation-fade-in">
                    <div className="mb-4 text-sm text-muted-foreground flex items-center gap-2 bg-emerald-50/50 text-emerald-800 p-3 rounded-md border border-emerald-100">
                        <Plus size={16} className="text-emerald-500" />
                        These are your custom habits. Assign them globally here, or to specific Saliks via the My Saliks directory.
                    </div>
                    {renderTable(groupByCategory(poolTemplates), true)}
                </TabsContent>
            </Tabs>
        </div>
    );
}
