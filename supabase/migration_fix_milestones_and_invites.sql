-- ============================================================
-- GARAGE — Migración: Corrección de hitos y eliminación de auto-invitaciones
-- ============================================================

-- 1. Actualizar get_project_role para que si el usuario es el creador del proyecto (projects.created_by),
-- devuelva siempre 'owner', incluso si su registro en project_members faltase o tuviera otro rol.
CREATE OR REPLACE FUNCTION get_project_role(p_id uuid, u_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_role text;
  v_creator uuid;
BEGIN
  -- Si es el creador del proyecto en la tabla projects, es inequívocamente el owner
  SELECT created_by INTO v_creator FROM projects WHERE id = p_id;
  IF v_creator IS NOT NULL AND v_creator = u_id THEN
    RETURN 'owner';
  END IF;

  SELECT role INTO v_role FROM project_members WHERE project_id = p_id AND user_id = u_id LIMIT 1;
  RETURN v_role;
END;
$$;

-- 2. Asegurar que todos los creadores de proyectos existentes tengan registro en project_members con rol 'owner'
INSERT INTO project_members (project_id, user_id, added_by, role)
SELECT id, created_by, created_by, 'owner'
FROM projects
WHERE created_by IS NOT NULL
ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner';

-- 3. Reforzar las políticas RLS sobre la tabla milestones
DROP POLICY IF EXISTS "Ver hitos miembros" ON milestones;
CREATE POLICY "Ver hitos miembros" ON milestones
  FOR SELECT USING (
    get_project_role(project_id, auth.uid()) IS NOT NULL
    OR
    EXISTS (SELECT 1 FROM projects p WHERE p.id = milestones.project_id AND p.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Gestionar hitos (Owner y Admin)" ON milestones;
CREATE POLICY "Gestionar hitos (Owner y Admin)" ON milestones
  FOR ALL USING (
    get_project_role(project_id, auth.uid()) IN ('owner', 'admin')
    OR
    EXISTS (SELECT 1 FROM projects p WHERE p.id = milestones.project_id AND p.created_by = auth.uid())
  )
  WITH CHECK (
    get_project_role(project_id, auth.uid()) IN ('owner', 'admin')
    OR
    EXISTS (SELECT 1 FROM projects p WHERE p.id = milestones.project_id AND p.created_by = auth.uid())
  );

-- 4. Actualizar trigger on_project_created para que SOLO añada al creador como 'owner'.
-- IMPORTANTE: Ya NO se auto-invitan colaboradores de GitHub. Toda invitación debe ser explícita.
CREATE OR REPLACE FUNCTION auto_add_known_collaborators()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Añadir creador con rol 'owner'
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO project_members (project_id, user_id, added_by, role)
    VALUES (NEW.id, NEW.created_by, NEW.created_by, 'owner')
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner';
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Actualizar sync_user_projects para que NO auto-enrole en proyectos.
-- Solo actualiza el perfil en la tabla profiles.
CREATE OR REPLACE FUNCTION sync_user_projects(user_repos text[], github_user text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Actualizar o registrar perfil con su username
  IF github_user IS NOT NULL THEN
    INSERT INTO profiles (id, github_username)
    VALUES (auth.uid(), lower(github_user))
    ON CONFLICT (id) DO UPDATE SET
      github_username = lower(EXCLUDED.github_username);
  END IF;

  -- Ya no se auto-insertan registros en project_members
END;
$$;

-- 6. Asegurar que el creador de un proyecto siempre pueda verlo y gestionarlo
DROP POLICY IF EXISTS "Solo miembros — projects" ON projects;
CREATE POLICY "Solo miembros — projects" ON projects
  FOR ALL USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = projects.id AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (auth.role() = 'authenticated');

