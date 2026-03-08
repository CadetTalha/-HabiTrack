'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Eye, EyeOff, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { PAKISTANI_UNIVERSITIES, HEC_DEGREES } from '@/constants/profile-data';

export default function CompleteProfilePage() {
    const [loading, setLoading] = useState(false);
    const [fetchingData, setFetchingData] = useState(true);
    const [showPassword, setShowPassword] = useState(false);

    const [role, setRole] = useState<'admin' | 'murabbi' | 'salik'>('salik');
    const [murabbis, setMurabbis] = useState<{ id: string, full_name: string, degree: string }[]>([]);

    const [formData, setFormData] = useState({
        full_name: '',
        university: '',
        university_other: '',
        degree: '',
        degree_other: '',
        mobile_number: '',
        password: '',
        confirm_password: '',
        murabbi_id: ''
    });

    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const loadInitialData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role, is_profile_complete')
                .eq('id', user.id)
                .single();

            if (profile?.is_profile_complete) {
                router.push(`/${profile.role}`);
                return;
            }

            setRole(profile?.role || 'salik');

            if (profile?.role === 'salik') {
                const { data: availableMurabbis } = await supabase
                    .from('profiles')
                    .select('id, full_name, degree')
                    .eq('role', 'murabbi')
                    .eq('is_profile_complete', true);

                if (availableMurabbis) setMurabbis(availableMurabbis);
            }

            setFetchingData(false);
        };
        loadInitialData();
    }, [supabase, router]);

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                toast.error("Image must be smaller than 2MB");
                return;
            }
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Upload avatar if exists
        let finalAvatarUrl = null;
        if (avatarFile) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const fileExt = avatarFile.name.split('.').pop();
                const filePath = `${user.id}/${Math.random()}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('profile-pictures')
                    .upload(filePath, avatarFile);

                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage
                        .from('profile-pictures')
                        .getPublicUrl(filePath);
                    finalAvatarUrl = publicUrl;

                    await supabase.from('profiles').update({ avatar_url: finalAvatarUrl }).eq('id', user.id);
                }
            }
        }

        const res = await fetch('/api/profile/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await res.json();

        if (!res.ok) {
            toast.error(data.error || 'Failed to complete profile');
            setLoading(false);
            return;
        }

        toast.success("Welcome to HabiTrack AI! 🌙");
        router.push(`/${data.role}`);
    };

    if (fetchingData) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background border-t-4 border-primary">
            <Card className="w-full max-w-2xl shadow-lg border-primary/20">
                <CardHeader className="text-center pb-6">
                    <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-emerald-600">
                        Complete Your Profile
                    </CardTitle>
                    <CardDescription>
                        Please provide your details to finish setting up your account.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Avatar Upload */}
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative group cursor-pointer inline-block">
                                <input
                                    type="file"
                                    accept="image/jpeg, image/png, image/webp"
                                    className="hidden"
                                    id="avatar"
                                    onChange={handleAvatarChange}
                                />
                                <Label htmlFor="avatar" className="cursor-pointer">
                                    <div className="w-24 h-24 rounded-full border-2 border-dashed border-primary/50 overflow-hidden flex items-center justify-center bg-primary/5 hover:bg-primary/10 transition">
                                        {avatarPreview ? (
                                            <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <Camera className="w-8 h-8 text-primary/50" />
                                        )}
                                    </div>
                                    <div className="text-center mt-2 text-xs text-muted-foreground">Upload Photo</div>
                                </Label>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Full Name</Label>
                                <Input required value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Mobile Number</Label>
                                <Input required placeholder="03XX-XXXXXXX" value={formData.mobile_number} onChange={e => setFormData({ ...formData, mobile_number: e.target.value })} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>University</Label>
                                <Select onValueChange={val => setFormData({ ...formData, university: val })}>
                                    <SelectTrigger><SelectValue placeholder="Select University" /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(PAKISTANI_UNIVERSITIES).map(([group, unis]) => (
                                            <div key={group}>
                                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group}</div>
                                                {unis.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                            </div>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {formData.university === 'Other (enter manually)' && (
                                    <Input required placeholder="Enter University Name" className="mt-2" value={formData.university_other} onChange={e => setFormData({ ...formData, university_other: e.target.value })} />
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Degree</Label>
                                <Select onValueChange={val => setFormData({ ...formData, degree: val })}>
                                    <SelectTrigger><SelectValue placeholder="Select Degree" /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(HEC_DEGREES).map(([group, degrees]) => (
                                            <div key={group}>
                                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group}</div>
                                                {degrees.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                            </div>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {formData.degree === 'Other (enter manually)' && (
                                    <Input required placeholder="Enter Degree Name" className="mt-2" value={formData.degree_other} onChange={e => setFormData({ ...formData, degree_other: e.target.value })} />
                                )}
                            </div>
                        </div>

                        {role === 'salik' && (
                            <div className="space-y-2 border-t pt-4">
                                <Label className="text-primary font-semibold">Select Your Murrabi</Label>
                                <Select required onValueChange={val => setFormData({ ...formData, murabbi_id: val })}>
                                    <SelectTrigger className="h-12"><SelectValue placeholder="Choose a spiritual mentor..." /></SelectTrigger>
                                    <SelectContent>
                                        {murabbis.map(m => (
                                            <SelectItem key={m.id} value={m.id}>
                                                {m.full_name} — {m.degree || 'Mentor'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                            <div className="space-y-2 relative">
                                <Label>New Password</Label>
                                <Input required type={showPassword ? "text" : "password"} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="pr-10" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-8 text-muted-foreground hover:text-foreground">
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            <div className="space-y-2">
                                <Label>Confirm Password</Label>
                                <Input required type={showPassword ? "text" : "password"} value={formData.confirm_password} onChange={e => setFormData({ ...formData, confirm_password: e.target.value })} />
                            </div>
                        </div>

                        <Button type="submit" className="w-full mt-6" disabled={loading}>
                            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Profile...</> : 'Complete Setup'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
