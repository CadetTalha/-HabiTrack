// ════════════════════════════════════════════════════════════
// Zod Validation Schemas
// ════════════════════════════════════════════════════════════
import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const inviteSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    role: z.enum(['murabbi', 'salik']), // no admin allowed
});

export const completeProfileSchema = z.object({
    full_name: z.string().min(2, 'Full name must be at least 2 characters'),
    university: z.string().min(2, 'University is required'),
    university_other: z.string().optional(),
    degree: z.string().min(2, 'Degree is required'),
    degree_other: z.string().optional(),
    mobile_number: z.string().regex(/^03\d{2}-\d{7}$/, 'Must match format 03XX-XXXXXXX'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
    murabbi_id: z.string().uuid('Please select a Murabbi').optional(),
}).refine(data => data.password === data.confirm_password, {
    message: "Passwords don't match",
    path: ['confirm_password'],
});

export const habitSchema = z.object({
    name: z.string().min(1, 'Habit name is required').max(100),
    category: z.enum(['prayers', 'quran', 'azkar', 'nawafil', 'prohibitions', 'book_reading', 'bed_timings']),
    sub_category: z.string().optional().nullable(),
    input_type: z.enum(['checkbox', 'count_dropdown', 'rakaat_dropdown', 'time_picker']),
    count_options: z.array(z.number()).optional().nullable(),
});

export const reportItemSchema = z.object({
    habit_id: z.string().uuid(),
    status: z.enum(['completed', 'missed', 'unanswered']),
    input_value: z.any().optional(),
});

export const dailyReportSchema = z.object({
    report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    notes: z.string().max(500).optional(),
    items: z.array(reportItemSchema).min(1, 'At least one task item is required'),
});

export const aiChatSchema = z.object({
    message: z.string().min(1, 'Message cannot be empty').max(2000),
    thread_id: z.string().uuid('Thread ID is required'),
});

export const assignmentSchema = z.object({
    salik_id: z.string().uuid(),
    murabbi_id: z.string().uuid(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;
export type HabitInput = z.infer<typeof habitSchema>;
export type DailyReportInput = z.infer<typeof dailyReportSchema>;
export type AIChatInput = z.infer<typeof aiChatSchema>;
export type AssignmentInput = z.infer<typeof assignmentSchema>;
