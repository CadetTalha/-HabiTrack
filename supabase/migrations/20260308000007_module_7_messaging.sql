-- Migration: Multi-Tiered Messaging System
-- Description: Creates direct_messages table and enforces role-based hierarchy 
-- (Salik -> Murrabi, Murrabi -> Salik/Admin, Admin -> Anyone)

-- 1. Create direct_messages table
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dm_participants ON public.direct_messages (sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_dm_created_at ON public.direct_messages (created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: View (SELECT)
-- Users can only see messages where they are either the sender or receiver
CREATE POLICY "Users can view their own conversations"
ON public.direct_messages FOR SELECT
USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- 5. RLS Policy: Send (INSERT)
-- Enforce the hierarchical rules:
-- Admin: Any
-- Murrabi: Admin or Assigned Salik
-- Salik: Assigned Murrabi only

CREATE POLICY "Enforce hierarchical messaging rules"
ON public.direct_messages FOR INSERT
WITH CHECK (
    -- Rule 1: Admins can message anyone
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
    OR
    -- Rule 2: Murrabis can message Admins OR their assigned Saliks
    (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'murabbi')
        AND (
            -- Receiver is Admin
            EXISTS (SELECT 1 FROM public.profiles WHERE id = receiver_id AND role = 'admin')
            OR
            -- Receiver is an assigned Salik
            EXISTS (
                SELECT 1 FROM public.salik_murabbi_map 
                WHERE murabbi_id = auth.uid() 
                AND salik_id = receiver_id 
                AND is_active = true
            )
        )
    )
    OR
    -- Rule 3: Saliks can ONLY message their assigned Murrabi
    (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'salik')
        AND EXISTS (
            SELECT 1 FROM public.salik_murabbi_map 
            WHERE salik_id = auth.uid() 
            AND murabbi_id = receiver_id 
            AND is_active = true
        )
    )
);

-- 6. RLS Policy: Mark as Read (UPDATE)
-- Only the receiver can mark a message as read
CREATE POLICY "Only receiver can mark as read"
ON public.direct_messages FOR UPDATE
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);
