-- ============================================
-- MuntiCares - Phase 2 SQL Commands
-- ============================================

-- === 1. DROP UNUSED TABLES (if created earlier) ===
-- DROP TABLE IF EXISTS audit_logs CASCADE;
-- DROP TABLE IF EXISTS settings CASCADE;
-- DROP TABLE IF EXISTS site_content CASCADE;

-- === 2. ADD NEW COLUMNS TO TRANSACTIONS ===
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS platform_fee numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_payout numeric(10,2) DEFAULT 0;

-- === 3. CREATE ANNOUNCEMENTS TABLE ===
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_audience TEXT DEFAULT 'all',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated" ON announcements 
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow insert for admins" ON announcements 
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow delete for admins" ON announcements 
  FOR DELETE USING (true);
