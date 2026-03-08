-- ════════════════════════════════════════════════════════════════════
-- Module 4: HabiGuide (Chat System)
-- Adds ai_threads, updates ai_conversations for threading & bookmarks
-- ════════════════════════════════════════════════════════════════════

-- 1. Create ai_threads table
CREATE TABLE ai_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_threads_user ON ai_threads(user_id);
CREATE INDEX idx_ai_threads_last_message ON ai_threads(last_message_at DESC);

-- 2. Update existing ai_conversations table
ALTER TABLE ai_conversations
ADD COLUMN thread_id UUID REFERENCES ai_threads(id) ON DELETE CASCADE,
ADD COLUMN is_bookmarked BOOLEAN DEFAULT false;

CREATE INDEX idx_ai_conversations_thread ON ai_conversations(thread_id);
CREATE INDEX idx_ai_conversations_bookmarked ON ai_conversations(user_id) WHERE is_bookmarked = true;

-- 3. Row Level Security for ai_threads
ALTER TABLE ai_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "threads_user_select" ON ai_threads FOR SELECT USING (
  auth.uid() = user_id
);

CREATE POLICY "threads_user_insert" ON ai_threads FOR INSERT WITH CHECK (
  auth.uid() = user_id
);

CREATE POLICY "threads_user_update" ON ai_threads FOR UPDATE USING (
  auth.uid() = user_id
);

CREATE POLICY "threads_user_delete" ON ai_threads FOR DELETE USING (
  auth.uid() = user_id
);

CREATE POLICY "threads_admin_all" ON ai_threads FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- We assume ai_conversations already has RLS, but if we need to add specific
-- update policies for bookmarks:
DROP POLICY IF EXISTS "ai_conversations_update_own" ON ai_conversations;
CREATE POLICY "ai_conversations_update_own" ON ai_conversations FOR UPDATE USING (
  auth.uid() = user_id
);
