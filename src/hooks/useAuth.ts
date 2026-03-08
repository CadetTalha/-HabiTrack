// ════════════════════════════════════════════════════════════
// useAuth Hook – Client-side auth state management
// ════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const getUser = async () => {
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (user) {
                    setUser(user);
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', user.id)
                        .single();

                    if (profileData) {
                        setProfile(profileData as Profile);
                    }
                }
            } catch (error) {
                console.error('Auth error:', error);
            } finally {
                setLoading(false);
            }
        };

        getUser();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
            if (session?.user) {
                setUser(session.user);
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                if (profileData) {
                    setProfile(profileData as Profile);
                }
            } else {
                setUser(null);
                setProfile(null);
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, [supabase]);

    const signOut = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    return { user, profile, loading, signOut };
}
