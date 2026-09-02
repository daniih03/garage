-- ============================================================
-- GARAGE v2 — Supabase Schema
-- ATENCIÓN: Ejecuta esto en el SQL Editor de Supabase.
-- Elimina la tabla cards antigua y recrea todo desde cero.
-- ============================================================

-- ── Limpiar tablas anteriores ───────────────────────────────
DROP TABLE IF EXISTS card_comments CASCADE;
DROP TABLE IF EXISTS cards        CASCADE;
DROP TABLE IF EXISTS milestones   CASCADE;
DROP TABLE IF EXISTS projects     CASCADE;

-- ── Proyectos (repositorios de GitHub) ─────────────────────
CREATE TABLE projects (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_full_name  text        NOT NULL UNIQUE,   -- "daniih03/garage"
  repo_name       text        NOT NULL,           -- "garage"
  repo_url        text        NOT NULL,           -- "https://github.com/..."
  repo_acronym    text        NOT NULL,           -- "GRG"
  description     text,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated — projects" ON projects
  FOR ALL
  USING  (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

ALTER PUBLICATION supabase_realtime ADD TABLE projects;

-- ── Hitos (milestones) ──────────────────────────────────────
CREATE TABLE milestones (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number      integer     NOT NULL,              -- auto-incremental por proyecto
  title       text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, number)
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated — milestones" ON milestones
  FOR ALL
  USING  (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

ALTER PUBLICATION supabase_realtime ADD TABLE milestones;

-- ── Tarjetas ────────────────────────────────────────────────
CREATE TABLE cards (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid        NOT NULL REFERENCES projects(id)   ON DELETE CASCADE,
  milestone_id    uuid        NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  card_number     integer     NOT NULL,           -- auto-incremental por proyecto+hito
  display_id      text        NOT NULL,           -- "GRG-1-001"
  title           text        NOT NULL,
  description     text,
  status          text        NOT NULL DEFAULT 'todo'
                              CHECK (status IN ('todo','inprogress','done')),
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
CREATE POLICY "Authenticated — cards" ON cards
  FOR ALL
  USING  (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

ALTER PUBLICATION supabase_realtime ADD TABLE cards;

CREATE INDEX idx_cards_lookup ON cards(project_id, milestone_id, status, position);

-- ── Comentarios ─────────────────────────────────────────────
CREATE TABLE card_comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     uuid        NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  content     text        NOT NULL,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE card_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated — comments" ON card_comments
  FOR ALL
  USING  (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

ALTER PUBLICATION supabase_realtime ADD TABLE card_comments;
