-- ════════════════════════════════════════════════════════════
-- Migration: Module 2 Fix Foreign Key on report_items
-- ════════════════════════════════════════════════════════════

-- Rename template_id to habit_id and update the foreign key to point to habit_templates
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='report_items' AND column_name='template_id') THEN
        ALTER TABLE public.report_items DROP CONSTRAINT IF EXISTS report_items_template_id_fkey;
        ALTER TABLE public.report_items RENAME COLUMN template_id TO habit_id;
        ALTER TABLE public.report_items ADD CONSTRAINT report_items_habit_id_fkey FOREIGN KEY (habit_id) REFERENCES public.habit_templates(id) ON DELETE CASCADE;
    END IF;
END $$;
