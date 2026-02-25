-- # Update RLS Policies for Application-Level Authentication
--
-- ## Overview
-- This migration updates the RLS policies to work with application-level authentication
-- (Passport.js sessions) instead of Supabase Auth. Since the application manages its own
-- authentication, we'll use simpler policies that allow authenticated database users
-- to access the data.
--
-- ## Changes
-- 1. Drop existing restrictive RLS policies
-- 2. Create new permissive policies for authenticated database role
-- 3. Keep RLS enabled for data protection

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can view own templates" ON templates;
DROP POLICY IF EXISTS "Users can create own templates" ON templates;
DROP POLICY IF EXISTS "Users can update own templates" ON templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON templates;
DROP POLICY IF EXISTS "Users can view own verifications" ON verifications;
DROP POLICY IF EXISTS "Users can create own verifications" ON verifications;
DROP POLICY IF EXISTS "Users can update own verifications" ON verifications;
DROP POLICY IF EXISTS "Users can delete own verifications" ON verifications;

-- Create permissive policies for application-level auth
-- Users table policies
CREATE POLICY "Allow all operations on users"
  ON users
  FOR ALL
  TO postgres
  USING (true)
  WITH CHECK (true);

-- Templates table policies
CREATE POLICY "Allow all operations on templates"
  ON templates
  FOR ALL
  TO postgres
  USING (true)
  WITH CHECK (true);

-- Verifications table policies
CREATE POLICY "Allow all operations on verifications"
  ON verifications
  FOR ALL
  TO postgres
  USING (true)
  WITH CHECK (true);