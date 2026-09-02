-- ============================================================
-- GARAGE v2 — Supabase Schema
-- ============================================================

-- ── 1. Perfiles (para invitar usuarios por GitHub username) ──
CREATE TABLE IF NOT EXISTS profiles (
  id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_username  text UNIQUE,
  avatar_url       text,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leer perfiles" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Auto-crear perfil cuando alguien hace login
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, github_username, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    github_username = COALESCE(EXCLUDED.github_username, profiles.github_username),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── 2. Proyectos (repositorios de GitHub) ─────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_full_name        text        NOT NULL UNIQUE,
  repo_name             text        NOT NULL,
  repo_url              text        NOT NULL,
  repo_acronym          text        NOT NULL,
  description           text,
  github_collaborators  text[]      DEFAULT '{}',
  created_by            uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE projects;

-- ── 3. Miembros del proyecto ────────────────────────────────
CREATE TABLE IF NOT EXISTS project_members (
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at    timestamptz DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE project_members;

-- Políticas de project_members
CREATE POLICY "Ver propias membresías" ON project_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Miembros añaden miembros" ON project_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_members.project_id
        AND pm.user_id = auth.uid()
    )
  );

-- Members can remove themselves (leave) or project creator can remove others (kick)
CREATE POLICY "Salir o expulsar miembros" ON project_members
  FOR DELETE USING (
    -- Leaving: removing yourself
    user_id = auth.uid()
    OR
    -- Kicking: you are the project creator
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.created_by = auth.uid()
    )
  );

-- Auto-añadir creador y colaboradores conocidos al crear un proyecto
CREATE OR REPLACE FUNCTION auto_add_known_collaborators()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Añadir creador
  INSERT INTO project_members (project_id, user_id, added_by)
  VALUES (NEW.id, NEW.created_by, NEW.created_by)
  ON CONFLICT (project_id, user_id) DO NOTHING;

  -- Añadir usuarios existentes en profiles cuyos usernames coincidan
  IF NEW.github_collaborators IS NOT NULL THEN
    INSERT INTO project_members (project_id, user_id, added_by)
    SELECT NEW.id, pr.id, NEW.created_by
    FROM profiles pr
    WHERE lower(pr.github_username) = ANY(
      SELECT lower(unnest(NEW.github_collaborators))
    )
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_project_created ON projects;
CREATE TRIGGER on_project_created
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION auto_add_known_collaborators();

-- Función RPC para auto-sincronizar membresías basándose en los repos del usuario en GitHub
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

  -- Añadir al usuario a project_members para cualquier proyecto que esté en sus repos o colaboradores
  INSERT INTO project_members (project_id, user_id, added_by)
  SELECT p.id, auth.uid(), p.created_by
  FROM projects p
  WHERE (
    (user_repos IS NOT NULL AND lower(p.repo_full_name) = ANY(
      SELECT lower(unnest(user_repos))
    ))
    OR
    (github_user IS NOT NULL AND p.github_collaborators IS NOT NULL AND lower(github_user) = ANY(
      SELECT lower(unnest(p.github_collaborators))
    ))
  )
  ON CONFLICT (project_id, user_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_user_projects(text[], text) TO authenticated;

-- Políticas de projects
CREATE POLICY "Solo miembros — projects" ON projects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = projects.id AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (auth.role() = 'authenticated');

-- ── 4. Hitos (milestones) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS milestones (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number      integer     NOT NULL,
  title       text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, number)
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE milestones;

CREATE POLICY "Solo miembros — milestones" ON milestones
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = milestones.project_id AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = milestones.project_id AND pm.user_id = auth.uid()
    )
  );

-- ── 5. Tarjetas ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cards (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid        NOT NULL REFERENCES projects(id)   ON DELETE CASCADE,
  milestone_id    uuid        NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  card_number     integer     NOT NULL,
  display_id      text        NOT NULL,
  title           text        NOT NULL,
  description     text,
  status          text        NOT NULL DEFAULT 'todo'
                              CHECK (status IN ('todo','doing','inprogress','blocked','done')),
  primary_type    text        CHECK (primary_type    IN ('HW','SW')),
  secondary_type  text        CHECK (secondary_type  IN ('task','bug','spike','stock')),
  priority        text        CHECK (priority         IN ('low','mid','high','critical')),
  github_url      text,
  position        integer     NOT NULL DEFAULT 0,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, milestone_id, card_number)
);

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE cards;

CREATE INDEX IF NOT EXISTS idx_cards_lookup ON cards(project_id, milestone_id, status, position);

CREATE POLICY "Solo miembros — cards" ON cards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = cards.project_id AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = cards.project_id AND pm.user_id = auth.uid()
    )
  );

-- ── 6. Comentarios ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS card_comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     uuid        NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  content     text        NOT NULL,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE card_comments ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE card_comments;

CREATE POLICY "Solo miembros — comments" ON card_comments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      JOIN cards c ON c.id = card_comments.card_id
      WHERE pm.project_id = c.project_id AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      JOIN cards c ON c.id = card_comments.card_id
      WHERE pm.project_id = c.project_id AND pm.user_id = auth.uid()
    )
  );
