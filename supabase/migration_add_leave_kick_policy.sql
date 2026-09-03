-- ============================================================
-- MIGRATION: Add DELETE RLS policy on project_members
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Allow members to leave, or the project creator to kick others
CREATE POLICY "Salir o expulsar miembros" ON project_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.created_by = auth.uid()
    )
  );
