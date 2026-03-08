-- Migration: Module 1-E Admin-Controlled Invite Flow
-- Description: Adds university, degree, mobile_number, and is_profile_complete to profiles. Creates profile-pictures bucket.

-- 1. Alter profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS university text,
ADD COLUMN IF NOT EXISTS degree text,
ADD COLUMN IF NOT EXISTS mobile_number text,
ADD COLUMN IF NOT EXISTS is_profile_complete boolean DEFAULT false;

-- To prevent locking out existing developers/test accounts, set existing profiles to complete:
UPDATE public.profiles SET is_profile_complete = true WHERE is_profile_complete = false;

-- 2. Ensure assignment rules (one active Salik mapping only)
-- Note: 'salik_murabbi_map' exists. We need to ensure salik_id is unique where is_active is true.
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'idx_unique_active_salik_mapping'
  ) THEN
    CREATE UNIQUE INDEX idx_unique_active_salik_mapping ON public.salik_murabbi_map (salik_id) WHERE is_active = true;
  END IF;
END $$;

-- 3. Create Storage bucket for profile pictures
INSERT INTO storage.buckets (id, name, public) 
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for 'profile-pictures'

-- Allow public read access
CREATE POLICY "Public profile pictures are viewable by everyone." 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'profile-pictures' );

-- Allow authenticated users to upload to their own folder within the bucket
CREATE POLICY "Users can upload their own profile picture." 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'profile-pictures' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own profile picture
CREATE POLICY "Users can update their own profile picture." 
ON storage.objects FOR UPDATE 
USING (
    bucket_id = 'profile-pictures' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);
