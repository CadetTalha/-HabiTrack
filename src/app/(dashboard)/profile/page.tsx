// ════════════════════════════════════════════════════════════
// Profile Page – Manage Personal Identity
// ════════════════════════════════════════════════════════════
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AvatarUpload } from '@/components/shared/AvatarUpload';
import { Loader2, Save, User, Building2, GraduationCap, Phone, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfilePage() {
    const { profile: authProfile, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<any>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            const res = await fetch('/api/profile');
            if (res.ok) {
                const data = await res.json();
                setProfile(data);
            }
            setLoading(false);
        };
        fetchProfile();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profile)
            });

            if (!res.ok) throw new Error('Failed to update profile');

            toast.success('Settings updated successfully!');
            // Refresh local auth state if possible or just rely on local state
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!profile) return null;

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            {/* Header Section */}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary/80 to-primary/50 bg-clip-text text-transparent">
                    Profile Settings
                </h1>
                <p className="text-muted-foreground text-sm">
                    Manage your personal identity and educational information across HabiTrack.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: Avatar & Quick Info */}
                <div className="md:col-span-1 space-y-6">
                    <Card className="border border-white/20 dark:border-white/5 shadow-xl glass-panel bg-card/40 overflow-hidden">
                        <CardContent className="p-8 flex flex-col items-center text-center">
                            <AvatarUpload
                                userId={profile.id}
                                currentUrl={profile.avatar_url}
                                onUploadComplete={(url) => setProfile({ ...profile, avatar_url: url })}
                            />

                            <div className="mt-6 space-y-1">
                                <h3 className="font-bold text-lg">{profile.full_name}</h3>
                                <p className="text-[10px] uppercase tracking-widest text-primary font-bold bg-primary/10 px-3 py-1 rounded-full inline-block">
                                    {profile.role}
                                </p>
                            </div>

                            <div className="w-full h-[1px] bg-white/10 my-6" />

                            <div className="w-full space-y-3">
                                <div className="flex items-center gap-3 text-left">
                                    <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary/60 shrink-0">
                                        <ShieldCheck size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Account Status</p>
                                        <p className="text-xs font-semibold text-emerald-500">Verified & Active</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Forms */}
                <div className="md:col-span-2 space-y-6">
                    <form onSubmit={handleSave} className="space-y-6">
                        {/* Personal Information */}
                        <Card className="border border-white/20 dark:border-white/5 shadow-xl glass-panel bg-card/40">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <User size={18} className="text-primary" />
                                    <CardTitle className="text-base font-bold">Personal Information</CardTitle>
                                </div>
                                <CardDescription className="text-xs">Your public display name and contact details.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="full_name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</Label>
                                    <Input
                                        id="full_name"
                                        value={profile.full_name || ''}
                                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                                        className="bg-background/40 border-white/10 rounded-xl"
                                        placeholder="Enter your full name"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="mobile" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mobile Number</Label>
                                    <div className="relative">
                                        <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            id="mobile"
                                            value={profile.mobile_number || ''}
                                            onChange={(e) => setProfile({ ...profile, mobile_number: e.target.value })}
                                            className="bg-background/40 border-white/10 rounded-xl pl-9"
                                            placeholder="+92 300 1234567"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Educational Information */}
                        <Card className="border border-white/20 dark:border-white/5 shadow-xl glass-panel bg-card/40">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Building2 size={18} className="text-primary" />
                                    <CardTitle className="text-base font-bold">Educational Details</CardTitle>
                                </div>
                                <CardDescription className="text-xs">Your academic background and affiliation.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="university" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">University</Label>
                                        <div className="relative">
                                            <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                id="university"
                                                value={profile.university || ''}
                                                onChange={(e) => setProfile({ ...profile, university: e.target.value })}
                                                className="bg-background/40 border-white/10 rounded-xl pl-9"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="degree" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Degree Program</Label>
                                        <div className="relative">
                                            <GraduationCap size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                id="degree"
                                                value={profile.degree || ''}
                                                onChange={(e) => setProfile({ ...profile, degree: e.target.value })}
                                                className="bg-background/40 border-white/10 rounded-xl pl-9"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Save Button */}
                        <div className="flex justify-end pt-4">
                            <Button
                                type="submit"
                                disabled={saving}
                                className="px-8 rounded-xl font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving Changes...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Profile
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
