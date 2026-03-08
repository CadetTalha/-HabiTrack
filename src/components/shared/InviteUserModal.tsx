// ════════════════════════════════════════════════════════════
// CreateUserModal – Admin form to create users directly
// No email invite — fills all details, user can login immediately
// ════════════════════════════════════════════════════════════
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { PAKISTANI_UNIVERSITIES, HEC_DEGREES } from '@/constants/profile-data';

interface CreateUserModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultRole?: 'admin' | 'murabbi' | 'salik';
    murabbiId?: string;           // Pre-assigns Salik to this Murrabi
    onSuccess?: () => void;
    trigger?: React.ReactNode;    // Optional custom trigger (unused here, open is controlled externally)
}

interface MurabbiOption {
    id: string;
    full_name: string;
    degree?: string;
}

export function CreateUserModal({ open, onOpenChange, defaultRole = 'salik', murabbiId, onSuccess }: CreateUserModalProps) {
    const [mounted, setMounted] = useState(false);
    const supabase = createClient();
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [showPw, setShowPw] = useState(false);
    const [murabbis, setMurabbis] = useState<MurabbiOption[]>([]);

    useEffect(() => {
        setMounted(true);
    }, []);

    // ... existing state and logic ...

    const [form, setForm] = useState({
        full_name: '',
        email: '',
        password: '',
        confirm_password: '',
        role: defaultRole,
        university: '',
        university_other: '',
        degree: '',
        degree_other: '',
        mobile_number: '',
        murabbi_id: murabbiId || '',
    });

    const set = (field: string, val: string) => setForm(f => ({ ...f, [field]: val }));

    // Fetch murabbis when role is salik
    useEffect(() => {
        if (form.role !== 'salik') return;
        supabase
            .from('profiles')
            .select('id, full_name, degree')
            .eq('role', 'murabbi')
            .eq('is_profile_complete', true)
            .then(({ data }) => setMurabbis((data as MurabbiOption[]) || []));
    }, [form.role, supabase]);

    // Reset when closed
    useEffect(() => {
        if (!open) {
            setTimeout(() => {
                setDone(false);
                setForm({ full_name: '', email: '', password: '', confirm_password: '', role: defaultRole, university: '', university_other: '', degree: '', degree_other: '', mobile_number: '', murabbi_id: murabbiId || '' });
            }, 300);
        }
    }, [open, defaultRole, murabbiId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (form.password !== form.confirm_password) { toast.error('Passwords do not match'); return; }
        if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }

        setLoading(true);
        try {
            const finalUniversity = form.university === 'Other (enter manually)' ? form.university_other : form.university;
            const finalDegree = form.degree === 'Other (enter manually)' ? form.degree_other : form.degree;

            const res = await fetch('/api/admin/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: form.full_name,
                    email: form.email,
                    password: form.password,
                    role: form.role,
                    university: finalUniversity || null,
                    degree: finalDegree || null,
                    mobile_number: form.mobile_number || null,
                    murabbi_id: form.role === 'salik' ? (form.murabbi_id || null) : null,
                }),
            });

            const data = await res.json();
            if (!res.ok) { toast.error(data.error || 'Failed to create user'); return; }

            setDone(true);
            toast.success(`${form.full_name} created successfully! They can log in now.`);
            onSuccess?.();
        } catch {
            toast.error('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const ROLE_COLORS: Record<string, string> = {
        admin: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
        murabbi: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
        salik: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
    };

    if (!mounted) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <UserPlus size={20} className="text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold">Create New User</DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                                Fill in the details below. The user can log in immediately after creation.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {done ? (
                    /* ── Success State ── */
                    <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <CheckCircle2 size={32} className="text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-lg font-bold text-foreground">{form.full_name} is ready! 🎉</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Account created as <Badge variant="outline" className={`${ROLE_COLORS[form.role]} capitalize ml-1`}>{form.role}</Badge>.
                                <br />They can log in with <span className="font-medium">{form.email}</span> right away.
                            </p>
                        </div>
                        <div className="flex gap-2 mt-2">
                            <Button variant="outline" onClick={() => { setDone(false); setForm(f => ({ ...f, full_name: '', email: '', password: '', confirm_password: '', mobile_number: '' })); }}>
                                Add Another
                            </Button>
                            <Button onClick={() => onOpenChange(false)}>Done</Button>
                        </div>
                    </div>
                ) : (
                    /* ── Form ── */
                    <form onSubmit={handleSubmit} className="space-y-5 pt-2">

                        {/* Role selector */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Role</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['admin', 'murabbi', 'salik'] as const).map(r => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => set('role', r)}
                                        className={`py-2.5 rounded-xl border text-sm font-medium capitalize transition-all ${form.role === r
                                            ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                            : 'border-border/50 text-muted-foreground hover:border-border hover:bg-muted/30'
                                            }`}
                                    >
                                        {r === 'admin' ? '🛡️' : r === 'murabbi' ? '🎓' : '📖'} {r.charAt(0).toUpperCase() + r.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Basic info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Full Name <span className="text-destructive">*</span></Label>
                                <Input required placeholder="e.g. Ahmed Ali" value={form.full_name} onChange={e => set('full_name', e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Mobile Number</Label>
                                <Input placeholder="03XX-XXXXXXX" value={form.mobile_number} onChange={e => set('mobile_number', e.target.value)} />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                            <Label>Email Address <span className="text-destructive">*</span></Label>
                            <Input required type="email" placeholder="user@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
                        </div>

                        {/* Password */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5 relative">
                                <Label>Password <span className="text-destructive">*</span></Label>
                                <Input
                                    required
                                    type={showPw ? 'text' : 'password'}
                                    placeholder="Min. 8 characters"
                                    value={form.password}
                                    onChange={e => set('password', e.target.value)}
                                    className="pr-10"
                                />
                                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-8 text-muted-foreground hover:text-foreground">
                                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Confirm Password <span className="text-destructive">*</span></Label>
                                <Input
                                    required
                                    type={showPw ? 'text' : 'password'}
                                    placeholder="Re-enter password"
                                    value={form.confirm_password}
                                    onChange={e => set('confirm_password', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* University & Degree */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>University</Label>
                                <Select onValueChange={val => set('university', val)}>
                                    <SelectTrigger><SelectValue placeholder="Select university" /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(PAKISTANI_UNIVERSITIES).map(([group, unis]) => (
                                            <div key={group}>
                                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group}</div>
                                                {unis.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                            </div>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {form.university === 'Other (enter manually)' && (
                                    <Input className="mt-2" placeholder="Enter university name" value={form.university_other} onChange={e => set('university_other', e.target.value)} />
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label>Degree</Label>
                                <Select onValueChange={val => set('degree', val)}>
                                    <SelectTrigger><SelectValue placeholder="Select degree" /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(HEC_DEGREES).map(([group, degrees]) => (
                                            <div key={group}>
                                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group}</div>
                                                {degrees.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                            </div>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {form.degree === 'Other (enter manually)' && (
                                    <Input className="mt-2" placeholder="Enter degree name" value={form.degree_other} onChange={e => set('degree_other', e.target.value)} />
                                )}
                            </div>
                        </div>

                        {/* Murrabi assignment for Salik */}
                        {form.role === 'salik' && (
                            <div className="space-y-1.5 border-t pt-4">
                                <Label className="text-primary font-semibold">Assign to Murrabi</Label>
                                <Select defaultValue={murabbiId} onValueChange={val => set('murabbi_id', val)}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Choose a Murrabi (optional)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {murabbis.length === 0 ? (
                                            <div className="px-3 py-4 text-sm text-muted-foreground text-center">No Murrabis available yet</div>
                                        ) : (
                                            murabbis.map(m => (
                                                <SelectItem key={m.id} value={m.id}>
                                                    {m.full_name}{m.degree ? ` — ${m.degree}` : ''}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Submit */}
                        <div className="flex justify-end gap-2 pt-2 border-t">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
                            <Button type="submit" disabled={loading} className="min-w-[130px]">
                                {loading ? <><Loader2 size={15} className="mr-2 animate-spin" />Creating...</> : <><UserPlus size={15} className="mr-2" />Create User</>}
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─── Backward-compatible alias used by existing pages that call <InviteUserModal> ───
export { CreateUserModal as InviteUserModal };
