-- ════════════════════════════════════════════════════════════════════
-- Module 3: Chilla (40-Day) Progress & AI Summary
-- Adds the chilla_records table, updates chilla_summaries schema,
-- and configures row-level security.
-- ════════════════════════════════════════════════════════════════════

-- 1. Create chilla_records table
CREATE TABLE chilla_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salik_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    murabbi_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    chilla_number INTEGER NOT NULL DEFAULT 1,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_complete BOOLEAN DEFAULT false,
    total_submissions INTEGER DEFAULT 0,
    average_performance NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chilla_records_salik ON chilla_records(salik_id);
CREATE INDEX idx_chilla_records_murabbi ON chilla_records(murabbi_id);
CREATE INDEX idx_chilla_records_incomplete ON chilla_records(salik_id) WHERE is_complete = false;

-- Add updated_at trigger for chilla_records
CREATE TRIGGER set_updated_at_chilla_records
  BEFORE UPDATE ON chilla_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Update existing chilla_summaries table
ALTER TABLE chilla_summaries
ADD COLUMN chilla_record_id UUID REFERENCES chilla_records(id) ON DELETE CASCADE,
ADD COLUMN week1_avg NUMERIC(5,2) DEFAULT 0,
ADD COLUMN week2_avg NUMERIC(5,2) DEFAULT 0,
ADD COLUMN week3_avg NUMERIC(5,2) DEFAULT 0,
ADD COLUMN week4_avg NUMERIC(5,2) DEFAULT 0,
ADD COLUMN top_habits JSONB DEFAULT '[]'::jsonb,
ADD COLUMN missed_habits JSONB DEFAULT '[]'::jsonb,
ADD COLUMN category_averages JSONB DEFAULT '{}'::jsonb,
ADD COLUMN salik_notes_snapshot TEXT,
ADD COLUMN murabbi_notes_snapshot TEXT,
ADD COLUMN is_delivered BOOLEAN DEFAULT false,
ADD COLUMN delivered_at TIMESTAMPTZ;

CREATE INDEX idx_chilla_summaries_record ON chilla_summaries(chilla_record_id);

-- 3. Row Level Security for chilla_records
ALTER TABLE chilla_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cr_salik_select" ON chilla_records FOR SELECT USING (
  auth.uid() = salik_id
);

CREATE POLICY "cr_murabbi_select" ON chilla_records FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM salik_murabbi_map 
    WHERE salik_id = chilla_records.salik_id 
    AND murabbi_id = auth.uid() 
    AND is_active = true
  )
);

CREATE POLICY "cr_murabbi_insert" ON chilla_records FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM salik_murabbi_map 
    WHERE salik_id = chilla_records.salik_id 
    AND murabbi_id = auth.uid() 
    AND is_active = true
  )
);

CREATE POLICY "cr_murabbi_update" ON chilla_records FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM salik_murabbi_map 
    WHERE salik_id = chilla_records.salik_id 
    AND murabbi_id = auth.uid() 
    AND is_active = true
  )
);

CREATE POLICY "cr_admin_all" ON chilla_records FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4. Update Row Level Security for chilla_summaries
-- Drop existing broad select policy so we can tighten it for Saliks
DROP POLICY IF EXISTS "chilla_select" ON chilla_summaries;

-- Salik can only view their summary AFTER it is marked delivered by the Murabbi
CREATE POLICY "chilla_salik_select" ON chilla_summaries FOR SELECT USING (
  auth.uid() = salik_id AND is_delivered = true
);

-- Murabbi can read summaries for their Active Saliks
CREATE POLICY "chilla_murabbi_select" ON chilla_summaries FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM salik_murabbi_map 
    WHERE salik_id = chilla_summaries.salik_id 
    AND murabbi_id = auth.uid() 
    AND is_active = true
  )
);

CREATE POLICY "chilla_admin_select" ON chilla_summaries FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
