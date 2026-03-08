import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import { completeProfileSchema } from '@/lib/validations';
import { createNotification } from '@/lib/services/notifications';

export async function POST(request: Request) {
    try {
        const supabase = await createServerSupabaseClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Check current profile state
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, is_profile_complete')
            .eq('id', user.id)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        if (profile.is_profile_complete) {
            return NextResponse.json({ error: 'Profile is already complete.' }, { status: 400 });
        }

        // Parse input
        const body = await request.json();
        const result = completeProfileSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
        }

        const {
            full_name,
            university,
            university_other,
            degree,
            degree_other,
            mobile_number,
            password,
            murabbi_id
        } = result.data;

        const finalUniversity = university === 'Other (enter manually)' ? university_other : university;
        const finalDegree = degree === 'Other (enter manually)' ? degree_other : degree;

        if (!finalUniversity || !finalDegree) {
            return NextResponse.json({ error: 'University and Degree are required.' }, { status: 400 });
        }

        if (profile.role === 'salik' && !murabbi_id) {
            return NextResponse.json({ error: 'Saliks must select a Murabbi.' }, { status: 400 });
        }

        const adminSupabase = await createAdminSupabaseClient();

        // 1. Update user password using admin client to bypass any re-auth limits
        const { error: authError } = await adminSupabase.auth.admin.updateUserById(user.id, {
            password: password
        });

        if (authError) {
            return NextResponse.json({ error: authError.message }, { status: 400 });
        }

        // 2. Update Profile fields
        const { error: profileError } = await adminSupabase
            .from('profiles')
            .update({
                full_name,
                university: finalUniversity,
                degree: finalDegree,
                mobile_number,
                is_profile_complete: true
            })
            .eq('id', user.id);

        if (profileError) {
            return NextResponse.json({ error: profileError.message }, { status: 500 });
        }

        // Log completion
        await supabase.from('activity_logs').insert({
            user_id: user.id,
            action: 'PROFILE_COMPLETED',
            details: `Profile completed as ${profile.role}`
        });

        // 3. Handle Assignment if Salik
        if (profile.role === 'salik' && murabbi_id) {
            const { error: mapError } = await adminSupabase
                .from('salik_murabbi_map')
                .insert({
                    salik_id: user.id,
                    murabbi_id,
                    is_active: true
                });

            if (mapError) {
                console.error("Assignment mapping error:", mapError);
            }
        }

        // 4. Trigger Notifications
        if (profile.role === 'salik') {
            await createNotification({
                userId: user.id,
                title: 'Welcome to HabiTrack',
                message: `Assalamu Alaikum ${full_name}! Your account is ready. Your Chilla journey begins with your first report. 🌙`,
                type: 'info',
                actionUrl: '/salik'
            });

            if (murabbi_id) {
                await createNotification({
                    userId: murabbi_id,
                    title: 'New Salik Assigned',
                    message: `${full_name} has completed their profile and is ready to begin their Chilla.`,
                    type: 'info',
                    actionUrl: '/murabbi/saliks'
                });
            }
        }

        // Notify Admins
        const { data: admins } = await adminSupabase.from('profiles').select('id').eq('role', 'admin');
        if (admins) {
            for (const admin of admins) {
                await createNotification({
                    userId: admin.id,
                    title: 'New User Registered',
                    message: `${full_name} (${profile.role}) has completed their profile setup.`,
                    type: 'info'
                });
            }
        }

        return NextResponse.json({ message: 'Profile completed successfully!', role: profile.role });

    } catch (error) {
        console.error('Complete profile error:', error);
        return NextResponse.json({ error: 'Internal server error processing profile.' }, { status: 500 });
    }
}
