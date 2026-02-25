-- # Create Signature Verification Database Schema
--
-- ## Overview
-- This migration sets up the complete database schema for a signature verification application
-- with template management, multi-file comparisons, and verification history tracking.
--
-- ## 1. New Tables
--
-- ### users
-- - id (uuid, primary key) - Unique user identifier
-- - username (text, unique, not null) - User login name
-- - password (text, not null) - Hashed password for authentication
-- - role (text, not null, default: 'user') - User role (user/admin)
-- - api_key (text, nullable) - Optional API key for programmatic access
-- - created_at (timestamptz) - Account creation timestamp
--
-- ### templates
-- - id (uuid, primary key) - Unique template identifier
-- - name (text, not null) - Template name
-- - description (text, nullable) - Template description
-- - user_id (varchar, not null) - Foreign key to users table
-- - mask_regions (jsonb, not null) - Array of signature region definitions
-- - source_page_count (integer, default: 1) - Number of pages in source document
-- - file_slot_count (integer, default: 2) - Number of file slots for comparison
-- - dpi (integer, default: 200) - Resolution for signature extraction
-- - match_mode (text, default: 'relaxed') - Matching algorithm mode
-- - created_at (timestamptz) - Template creation timestamp
--
-- ### verifications
-- - id (uuid, primary key) - Unique verification identifier
-- - template_id (varchar, not null) - Foreign key to templates table
-- - user_id (varchar, not null) - Foreign key to users table
-- - confidence_score (real, nullable) - Overall confidence score (0-100)
-- - results (jsonb, nullable) - Detailed verification results
-- - file_names (jsonb, nullable) - Map of file slot numbers to filenames
-- - file1_name (text, nullable) - Legacy: First file name
-- - file2_name (text, nullable) - Legacy: Second file name
-- - created_at (timestamptz) - Verification timestamp
--
-- ## 2. Security
-- - Enable Row Level Security (RLS) on all tables
-- - Users can only read their own data
-- - Users can only create/update/delete their own templates and verifications
-- - Admin users have special privileges
--
-- ## 3. Indexes
-- - Created indexes on foreign keys for performance
-- - Created indexes on commonly queried fields (username, user_id relationships)

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  api_key text,
  created_at timestamptz DEFAULT now()
);

-- Create templates table
CREATE TABLE IF NOT EXISTS templates (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  name text NOT NULL,
  description text,
  user_id varchar NOT NULL,
  mask_regions jsonb NOT NULL,
  source_page_count integer DEFAULT 1,
  file_slot_count integer DEFAULT 2,
  dpi integer DEFAULT 200,
  match_mode text NOT NULL DEFAULT 'relaxed',
  created_at timestamptz DEFAULT now()
);

-- Create verifications table
CREATE TABLE IF NOT EXISTS verifications (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  template_id varchar NOT NULL,
  user_id varchar NOT NULL,
  confidence_score real,
  results jsonb,
  file_names jsonb,
  file1_name text,
  file2_name text,
  created_at timestamptz DEFAULT now()
);

-- Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'templates_user_id_fkey'
    AND table_name = 'templates'
  ) THEN
    ALTER TABLE templates ADD CONSTRAINT templates_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'verifications_template_id_fkey'
    AND table_name = 'verifications'
  ) THEN
    ALTER TABLE verifications ADD CONSTRAINT verifications_template_id_fkey 
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'verifications_user_id_fkey'
    AND table_name = 'verifications'
  ) THEN
    ALTER TABLE verifications ADD CONSTRAINT verifications_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_verifications_template_id ON verifications(template_id);
CREATE INDEX IF NOT EXISTS idx_verifications_user_id ON verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (id = current_setting('app.current_user_id', true)::varchar);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = current_setting('app.current_user_id', true)::varchar)
  WITH CHECK (id = current_setting('app.current_user_id', true)::varchar);

-- RLS Policies for templates table
CREATE POLICY "Users can view own templates"
  ON templates FOR SELECT
  TO authenticated
  USING (user_id = current_setting('app.current_user_id', true)::varchar);

CREATE POLICY "Users can create own templates"
  ON templates FOR INSERT
  TO authenticated
  WITH CHECK (user_id = current_setting('app.current_user_id', true)::varchar);

CREATE POLICY "Users can update own templates"
  ON templates FOR UPDATE
  TO authenticated
  USING (user_id = current_setting('app.current_user_id', true)::varchar)
  WITH CHECK (user_id = current_setting('app.current_user_id', true)::varchar);

CREATE POLICY "Users can delete own templates"
  ON templates FOR DELETE
  TO authenticated
  USING (user_id = current_setting('app.current_user_id', true)::varchar);

-- RLS Policies for verifications table
CREATE POLICY "Users can view own verifications"
  ON verifications FOR SELECT
  TO authenticated
  USING (user_id = current_setting('app.current_user_id', true)::varchar);

CREATE POLICY "Users can create own verifications"
  ON verifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = current_setting('app.current_user_id', true)::varchar);

CREATE POLICY "Users can update own verifications"
  ON verifications FOR UPDATE
  TO authenticated
  USING (user_id = current_setting('app.current_user_id', true)::varchar)
  WITH CHECK (user_id = current_setting('app.current_user_id', true)::varchar);

CREATE POLICY "Users can delete own verifications"
  ON verifications FOR DELETE
  TO authenticated
  USING (user_id = current_setting('app.current_user_id', true)::varchar);