-- ════════════════════════════════════════════════════════════
-- Migration: Module 2 Daily Reports & Templates
-- ════════════════════════════════════════════════════════════

-- 1. Create habit_templates table
CREATE TABLE IF NOT EXISTS public.habit_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('prayers', 'quran', 'azkar', 'nawafil', 'prohibitions', 'book_reading', 'bed_timings')),
    sub_category TEXT,
    input_type TEXT NOT NULL CHECK (input_type IN ('checkbox', 'count_dropdown', 'rakaat_dropdown', 'time_picker')),
    count_options JSONB,
    is_default BOOLEAN DEFAULT false,
    murabbi_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Protect habit_templates
ALTER TABLE public.habit_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access to default habits" 
  ON public.habit_templates FOR SELECT USING (is_default = true);
CREATE POLICY "Murabbis can view their pool habits" 
  ON public.habit_templates FOR SELECT USING (auth.uid() = murabbi_id);
CREATE POLICY "Murabbis can manage their pool habits" 
  ON public.habit_templates FOR ALL USING (auth.uid() = murabbi_id);
CREATE POLICY "Admins have full access to habits"
  ON public.habit_templates FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. Create salik_habit_assignments table
CREATE TABLE IF NOT EXISTS public.salik_habit_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    salik_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    habit_id UUID REFERENCES public.habit_templates(id) ON DELETE CASCADE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    assigned_by_murabbi_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(salik_id, habit_id)
);

-- Protect salik_habit_assignments
ALTER TABLE public.salik_habit_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Saliks can view their own habits" 
  ON public.salik_habit_assignments FOR SELECT USING (auth.uid() = salik_id);
CREATE POLICY "Murabbis can view and edit their saliks' habits" 
  ON public.salik_habit_assignments FOR ALL USING (
    EXISTS (SELECT 1 FROM public.salik_murabbi_map WHERE salik_id = salik_habit_assignments.salik_id AND murabbi_id = auth.uid() AND is_active = true)
  );
CREATE POLICY "Admins have full access to habit assignments"
  ON public.salik_habit_assignments FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. Modify daily_reports table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_reports' AND column_name='submitted_at') THEN
        ALTER TABLE public.daily_reports ADD COLUMN submitted_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_reports' AND column_name='report_date') THEN
        ALTER TABLE public.daily_reports ADD COLUMN report_date DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;
END $$;

-- 4. Modify report_items table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_item_status') THEN
        CREATE TYPE report_item_status AS ENUM ('completed', 'missed', 'unanswered');
    END IF;
END $$;

ALTER TABLE public.report_items ADD COLUMN IF NOT EXISTS status report_item_status DEFAULT 'unanswered';
ALTER TABLE public.report_items ADD COLUMN IF NOT EXISTS input_value JSONB;

-- Temporarily drop the old boolean constraint if it exists and then delete it
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='report_items' AND column_name='is_completed') THEN
        -- Migrate old rows just in case (true -> completed, false -> missed)
        UPDATE public.report_items SET status = CASE WHEN is_completed THEN 'completed'::report_item_status ELSE 'missed'::report_item_status END;
        -- Now drop
        ALTER TABLE public.report_items DROP COLUMN is_completed;
    END IF;
END $$;

-- 5. Create murabbi_report_notes table
CREATE TABLE IF NOT EXISTS public.murabbi_report_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_id UUID REFERENCES public.daily_reports(id) ON DELETE CASCADE NOT NULL,
    murabbi_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    note TEXT CHECK (char_length(note) <= 500) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Protect murabbi_report_notes
ALTER TABLE public.murabbi_report_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Saliks can read notes on their reports" 
  ON public.murabbi_report_notes FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.daily_reports WHERE id = murabbi_report_notes.report_id AND salik_id = auth.uid())
  );
CREATE POLICY "Murabbis can manage notes on their assigned saliks' reports" 
  ON public.murabbi_report_notes FOR ALL USING (
    auth.uid() = murabbi_id
  );
CREATE POLICY "Admins have full access to murabbi notes"
  ON public.murabbi_report_notes FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. Insert Default Templates
INSERT INTO public.habit_templates (name, category, sub_category, input_type, count_options, is_default, sort_order) VALUES
-- Prayers
('Fajr', 'prayers', NULL, 'checkbox', NULL, true, 10),
('Zuhr', 'prayers', NULL, 'checkbox', NULL, true, 20),
('Asr', 'prayers', NULL, 'checkbox', NULL, true, 30),
('Maghrib', 'prayers', NULL, 'checkbox', NULL, true, 40),
('Isha', 'prayers', NULL, 'checkbox', NULL, true, 50),

-- Quran
('Surah Yaseen', 'quran', NULL, 'checkbox', NULL, true, 10),
('Surah Waqia', 'quran', NULL, 'checkbox', NULL, true, 20),
('Surah Mulk', 'quran', NULL, 'checkbox', NULL, true, 30),
('Regular Recitation', 'quran', NULL, 'checkbox', NULL, true, 40),

-- Morning Azkar
('Astaghfar', 'azkar', 'morning', 'count_dropdown', '[100, 200, 300]'::jsonb, true, 10),
('Darood Shareef', 'azkar', 'morning', 'count_dropdown', '[100, 200, 300]'::jsonb, true, 20),
('Third Kalima', 'azkar', 'morning', 'count_dropdown', '[100, 200, 300]'::jsonb, true, 30),
('First Kalima', 'azkar', 'morning', 'count_dropdown', '[100, 200, 300]'::jsonb, true, 40),

-- Evening Azkar
('Astaghfar', 'azkar', 'evening', 'count_dropdown', '[100, 200, 300]'::jsonb, true, 50),
('Darood Shareef', 'azkar', 'evening', 'count_dropdown', '[100, 200, 300]'::jsonb, true, 60),
('Third Kalima', 'azkar', 'evening', 'count_dropdown', '[100, 200, 300]'::jsonb, true, 70),
('First Kalima', 'azkar', 'evening', 'count_dropdown', '[100, 200, 300]'::jsonb, true, 80),

-- Nawafil
('Tahajjud', 'nawafil', NULL, 'rakaat_dropdown', '[2, 4, 6, 8, 10, 12, 14, 16, 18, 20]'::jsonb, true, 10),
('Ishraq / Chasht', 'nawafil', NULL, 'rakaat_dropdown', '[2, 4, 6, 8, 10, 12, 14, 16, 18, 20]'::jsonb, true, 20),
('Awabeen', 'nawafil', NULL, 'rakaat_dropdown', '[2, 4, 6, 8, 10, 12, 14, 16, 18, 20]'::jsonb, true, 30),

-- Prohibitions
('Protection of Nazar', 'prohibitions', NULL, 'checkbox', NULL, true, 10),
('Protection of Zuban', 'prohibitions', NULL, 'checkbox', NULL, true, 20),
('No Music', 'prohibitions', NULL, 'checkbox', NULL, true, 30),

-- Book Reading
('Book Reading', 'book_reading', NULL, 'checkbox', NULL, true, 10),

-- Bed Timings
('Sleeping at', 'bed_timings', NULL, 'time_picker', NULL, true, 10),
('Waking up at', 'bed_timings', NULL, 'time_picker', NULL, true, 20)
ON CONFLICT DO NOTHING;

-- 7. Database Trigger for Auto-Assignment
CREATE OR REPLACE FUNCTION public.auto_assign_default_habits()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger when is_profile_complete changes from false to true AND the user is a salik
    IF NEW.is_profile_complete = true AND OLD.is_profile_complete = false AND NEW.role = 'salik' THEN
        INSERT INTO public.salik_habit_assignments (salik_id, habit_id, is_active)
        SELECT NEW.id, id, true
        FROM public.habit_templates
        WHERE is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_assign_defaults ON public.profiles;
CREATE TRIGGER trg_auto_assign_defaults
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_default_habits();
