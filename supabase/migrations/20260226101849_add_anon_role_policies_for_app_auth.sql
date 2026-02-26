/*
  # Add anon role policies for application-level authentication

  ## Overview
  The backend uses Supabase JS client with the anon key and handles authentication
  via Passport.js sessions at the application level. The service role key is not
  available, so we grant full access to the anon role on all tables. Security is
  enforced at the Express route level, not at the database level.

  ## Changes
  - Drop existing postgres-role policies that don't work with the JS client
  - Add new policies granting full access to the anon role on all three tables

  ## Note
  This is appropriate for server-side Express applications where the server itself
  enforces access control before calling the database.
*/

-- Drop existing postgres-role policies
DROP POLICY IF EXISTS "Allow all operations on users" ON users;
DROP POLICY IF EXISTS "Allow all operations on templates" ON templates;
DROP POLICY IF EXISTS "Allow all operations on verifications" ON verifications;

-- Grant full access to anon role (used by Supabase JS client with anon key)
-- Security is enforced at the application (Express) layer

CREATE POLICY "Allow anon access to users"
  ON users
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon access to templates"
  ON templates
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon access to verifications"
  ON verifications
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
