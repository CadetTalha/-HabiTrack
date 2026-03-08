-- ════════════════════════════════════════════════════════════════════
-- Module 5: Notifications System
-- Expands ENUM, adds action_url, creates notification_preferences table
-- ════════════════════════════════════════════════════════════════════

-- 1. Modify existing notifications table

-- 1a. Add action_url column
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'achievement';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'summary';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'action';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'info';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'broadcast';
-- 2. Create notification_preferences table
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reminder_enabled BOOLEAN DEFAULT true,
    alert_enabled BOOLEAN DEFAULT true,
    achievement_enabled BOOLEAN DEFAULT true,
    summary_enabled BOOLEAN DEFAULT true,
    motivational_enabled BOOLEAN DEFAULT true,
    info_enabled BOOLEAN DEFAULT true,
    broadcast_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id)
);

CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id);

-- 3. Row Level Security for notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prefs_user_select" ON notification_preferences FOR SELECT USING (
  auth.uid() = user_id
);

CREATE POLICY "prefs_user_insert" ON notification_preferences FOR INSERT WITH CHECK (
  auth.uid() = user_id
);

CREATE POLICY "prefs_user_update" ON notification_preferences FOR UPDATE USING (
  auth.uid() = user_id
);

CREATE POLICY "prefs_admin_all" ON notification_preferences FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Note: We also need to allow Service Role to insert/read notifications and preferences, 
-- but Supabase Service Role inherently bypasses RLS by default.

-- 4. Create trigger to update updated_at
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON notification_preferences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
