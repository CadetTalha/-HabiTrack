-- ════════════════════════════════════════════════════════════════════
-- Module 6: Admin Portal
-- Adds system_settings for dynamic cron & notification thresholds
-- ════════════════════════════════════════════════════════════════════

-- 1. Create system_settings table
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reminder_time TIME DEFAULT '22:00:00',
    murrabi_alert_time TIME DEFAULT '22:30:00',
    performance_threshold INTEGER DEFAULT 65,
    consecutive_miss_threshold INTEGER DEFAULT 5,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- 2. Establish RLS preventing non-admins from accessing or modifying
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_settings" ON system_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 3. Trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON system_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- 4. Seed singleton initial row
INSERT INTO system_settings (
    reminder_time, 
    murrabi_alert_time, 
    performance_threshold, 
    consecutive_miss_threshold
) VALUES (
    '22:00:00', 
    '22:30:00', 
    65, 
    5
);
