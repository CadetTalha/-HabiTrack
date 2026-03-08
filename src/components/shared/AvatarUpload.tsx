// ════════════════════════════════════════════════════════════
// AvatarUpload – Reusable component for Supabase Storage
// ════════════════════════════════════════════════════════════
'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Loader2, Upload, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface AvatarUploadProps {
    currentUrl?: string;
    onUploadComplete: (url: string) => void;
    userId: string;
}

export function AvatarUpload({ currentUrl, onUploadComplete, userId }: AvatarUploadProps) {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation
        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file.');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            toast.error('File size must be less than 2MB.');
            return;
        }

        setUploading(true);
        try {
            // Path: profile-pictures/{userId}/{timestamp}-{filename}
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}/${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('profile-pictures')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('profile-pictures')
                .getPublicUrl(filePath);

            onUploadComplete(publicUrl);
            toast.success('Avatar uploaded successfully!');
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error(error.message || 'Error uploading avatar');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative group">
                <Avatar className="w-24 h-24 border-4 border-white/10 dark:border-white/5 shadow-2xl ring-2 ring-primary/20 transition-transform group-hover:scale-105 duration-300">
                    <AvatarImage src={currentUrl} className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-tr from-primary/20 to-primary/5 text-primary text-2xl font-bold">
                        ?
                    </AvatarFallback>
                </Avatar>

                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-lg border-2 border-background hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
                >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                </button>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
            />

            <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                    Profile Picture
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                    JPG, PNG or GIF (Max 2MB)
                </p>
            </div>
        </div>
    );
}
