// ════════════════════════════════════════════════════════════
// HabiTrack AI – Core Type Definitions
// ════════════════════════════════════════════════════════════

export type UserRole = 'admin' | 'murabbi' | 'salik';

export interface Profile {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    university?: string;
    degree?: string;
    mobile_number?: string;
    is_profile_complete: boolean;
    avatar_url?: string;
    created_at: string;
    updated_at: string;
}

export interface SalikMurabbiMap {
    id: string;
    salik_id: string;
    murabbi_id: string;
    assigned_at: string;
    is_active: boolean;
    salik?: Profile;
    murabbi?: Profile;
}

export interface HabitTemplate {
    id: string;
    name: string;
    category: HabitCategory;
    sub_category?: string;
    input_type: HabitInputType;
    count_options?: number[] | null;
    is_default: boolean;
    murabbi_id?: string | null;
    sort_order: number;
    created_at: string;
}

export type HabitCategory =
    | 'prayers'
    | 'quran'
    | 'azkar'
    | 'nawafil'
    | 'prohibitions'
    | 'book_reading'
    | 'bed_timings';

export type HabitInputType = 'checkbox' | 'count_dropdown' | 'rakaat_dropdown' | 'time_picker';

import type { IconType } from 'react-icons';
import { FaMosque, FaBookOpen, FaRecycle, FaHands, FaBan, FaBook, FaMoon } from 'react-icons/fa';

export const HABIT_CATEGORIES: { value: HabitCategory; label: string; icon: IconType }[] = [
    { value: 'prayers', label: 'Prayers', icon: FaMosque },
    { value: 'quran', label: 'Quran Recitation', icon: FaBookOpen },
    { value: 'azkar', label: 'Azkar', icon: FaRecycle },
    { value: 'nawafil', label: 'Nawafil', icon: FaHands },
    { value: 'prohibitions', label: 'Prohibitions', icon: FaBan },
    { value: 'book_reading', label: 'Book Reading', icon: FaBook },
    { value: 'bed_timings', label: 'Bed Timings', icon: FaMoon },
];

export interface DailyReport {
    id: string;
    salik_id: string;
    report_date: string;
    completion_percentage: number;
    submitted_at: string;
    notes?: string;
    report_items?: ReportItem[];
}

export interface ReportItem {
    id: string;
    report_id: string;
    habit_id: string;
    status: 'completed' | 'missed' | 'unanswered';
    input_value?: any;
    habit_template?: HabitTemplate;
}

export interface AIConversation {
    id: string;
    user_id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
}

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: NotificationType;
    is_read: boolean;
    action_url?: string | null;
    created_at: string;
}

export type NotificationType =
    | 'reminder'
    | 'alert'
    | 'achievement'
    | 'summary'
    | 'action'
    | 'motivational'
    | 'info'
    | 'broadcast';

export interface ActivityLog {
    id: string;
    user_id: string;
    action: string;
    details?: string;
    created_at: string;
    user?: Profile;
}

export interface ChillaSummary {
    id: string;
    salik_id: string;
    murabbi_id: string;
    start_date: string;
    end_date: string;
    total_submissions: number;
    average_performance: number;
    most_missed_task?: string;
    streak_record: number;
    ai_summary?: string;
    murabbi_notes?: string;
    is_finalized: boolean;
    created_at: string;
    updated_at: string;
}

// ── Dashboard Stats ──
export interface AdminStats {
    totalSaliks: number;
    activeChillas: number;
    missedReports: number;
    averagePerformance: number;
    pendingInvites: number;
}

export interface MurabbiStats {
    assignedSaliks: number;
    nonSubmitted: number;
    lowPerformance: number;
    submittedToday: number;
}


export interface SalikStats {
    todayCompletion: number;
    currentStreak: number;
    fortyDayAverage: number;
    totalReports: number;
}
