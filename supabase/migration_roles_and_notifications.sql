-- ============================================================
-- GARAGE — Migración de Roles y Notificaciones Globales
-- ============================================================

-- 1. Añadir columna 'role' a project_members
ALTER TABLE project_members 
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member'
  CHECK (role IN ('owner', 'admin', 'member', 'guest'));

-- 2. Asegurar que los creadores de proyectos existentes tengan rol 'owner'
UPDATE project_members pm
SET role = 'owner'
FROM projects p
WHERE pm.project_id = p.id AND pm.user_id = p.created_by;

-- 3. Actualizar trigger on_project_created para que el creador siempre sea 'owner'
CREATE OR REPLACE FUNCTION auto_add_known_collaborators()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Añadir creador con rol 'owner'
  INSERT INTO project_members (project_id, user_id, added_by, role)
  VALUES (NEW.id, NEW.created_by, NEW.created_by, 'owner')
  ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner';

  -- Añadir usuarios existentes en profiles cuyos usernames coincidan (como 'member')
  IF NEW.github_collaborators IS NOT NULL THEN
    INSERT INTO project_members (project_id, user_id, added_by, role)
    SELECT NEW.id, pr.id, NEW.created_by, 'member'
    FROM profiles pr
    WHERE lower(pr.github_username) = ANY(
      SELECT lower(unnest(NEW.github_collaborators))
    )
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Función auxiliar segura para consultar el rol de un usuario en un proyecto
CREATE OR REPLACE FUNCTION get_project_role(p_id uuid, u_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM project_members WHERE project_id = p_id AND user_id = u_id LIMIT 1;
$$;

-- 5. Tabla de notificaciones globales de usuario
CREATE TABLE IF NOT EXISTS user_notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id   uuid REFERENCES projects(id) ON DELETE CASCADE,
  project_name text NOT NULL,
  type         text NOT NULL CHECK (type IN ('project_invite', 'role_change', 'project_kick')),
  title        text NOT NULL,
  message      text NOT NULL,
  metadata     jsonb DEFAULT '{}'::jsonb,
  read         boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE user_notifications;

CREATE POLICY "Ver propias notificaciones" ON user_notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Actualizar propias notificaciones (marcar leídas)" ON user_notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Insertar notificaciones para usuarios" ON user_notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Eliminar propias notificaciones" ON user_notifications
  FOR DELETE USING (user_id = auth.uid());

-- 6. Políticas RLS de Seguridad según Rol:

-- Hitos: Solo Owner y Admin pueden insertar, actualizar o eliminar hitos
DROP POLICY IF EXISTS "Solo miembros — milestones" ON milestones;
CREATE POLICY "Ver hitos miembros" ON milestones
  FOR SELECT USING (
    get_project_role(project_id, auth.uid()) IS NOT NULL
  );

CREATE POLICY "Gestionar hitos (Owner y Admin)" ON milestones
  FOR ALL USING (
    get_project_role(project_id, auth.uid()) IN ('owner', 'admin')
  )
  WITH CHECK (
    get_project_role(project_id, auth.uid()) IN ('owner', 'admin')
  );

-- Tarjetas: Owner, Admin y Member pueden mutar; Guest solo SELECT
DROP POLICY IF EXISTS "Solo miembros — cards" ON cards;
CREATE POLICY "Ver tarjetas miembros" ON cards
  FOR SELECT USING (
    get_project_role(project_id, auth.uid()) IS NOT NULL
  );

CREATE POLICY "Mutar tarjetas (Owner, Admin, Member)" ON cards
  FOR ALL USING (
    get_project_role(project_id, auth.uid()) IN ('owner', 'admin', 'member')
  )
  WITH CHECK (
    get_project_role(project_id, auth.uid()) IN ('owner', 'admin', 'member')
  );

-- Comentarios: Owner, Admin y Member pueden comentar
DROP POLICY IF EXISTS "Solo miembros — comments" ON card_comments;
CREATE POLICY "Ver comentarios miembros" ON card_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cards c 
      WHERE c.id = card_comments.card_id 
        AND get_project_role(c.project_id, auth.uid()) IS NOT NULL
    )
  );

CREATE POLICY "Insertar comentarios (Owner, Admin, Member)" ON card_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM cards c 
      WHERE c.id = card_comments.card_id 
        AND get_project_role(c.project_id, auth.uid()) IN ('owner', 'admin', 'member')
    )
  );

-- Project Members: RLS para actualizar roles y expulsar según jerarquía
DROP POLICY IF EXISTS "Salir o expulsar miembros" ON project_members;
CREATE POLICY "Gestionar miembros según rol" ON project_members
  FOR ALL USING (
    -- Salir de tu propia membresía si no eres owner
    (user_id = auth.uid() AND role != 'owner')
    OR
    -- Owner puede gestionar a cualquier miembro
    get_project_role(project_id, auth.uid()) = 'owner'
    OR
    -- Admin puede expulsar o modificar solo a members y guests
    (get_project_role(project_id, auth.uid()) = 'admin' AND role IN ('member', 'guest'))
  )
  WITH CHECK (
    -- Prohibir auto-asignarse owner
    role != 'owner'
    OR
    user_id = auth.uid()
  );
